require('dotenv').config();
const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { isolatedMarginLoanRaw } = require('../isolatedMarginLoanRaw');

const takeShortPosition = async (
    binance,
    symbol,
    type,
    price,
    usdcBalance,
    bot,
    chatId
) => {
    console.log('⬇️ Début de la position short...');

    if (usdcBalance <= 0) {
        throw new Error('Solde USDC insuffisant en marge isolée.');
    }

    // -------------------------------
    // 🔍 1. Récupération des règles du marché
    // -------------------------------
    const exchangeInfo = await binance.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

    const lot = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    const stepSize = parseFloat(lot.stepSize);
    const minQty = parseFloat(lot.minQty);
    const decimals = getDecimalPlaces(stepSize);

    const asset = symbol.replace('USDC', ''); // BTC ou DOGE

    // -------------------------------
    // 🧮 2. Calcul de la quantité à vendre
    // -------------------------------
    const feeRate = 0.001;
    let qty = (usdcBalance / price) * (1 - feeRate); // provision fees
    qty = Math.floor(qty / stepSize) * stepSize;
    qty = parseFloat(qty.toFixed(decimals));

    if (qty < minQty) {
        throw new Error(`Quantité trop faible : ${qty}`);
    }

    console.log(`🔢 Quantité demandée : ${qty}`);

    // -------------------------------
    // 🔐 3. Vérification du max borrow réel
    // -------------------------------

    const borrowInfo = await binance.marginMaxBorrow({
        asset,
        isolatedSymbol: symbol,
        isIsolated: 'TRUE'
    });

    const maxBorrowable = parseFloat(borrowInfo.amount);

    console.log(`📊 Max empruntable selon Binance : ${maxBorrowable}`);

    if (maxBorrowable <= 0) {
        throw new Error(`Montant empruntable nul pour ${symbol}.`);
    }

    // Limitation stricte
    if (qty > maxBorrowable) {
        console.warn(`⚠️ Quantité réduite de ${qty} → ${maxBorrowable}`);
        qty = maxBorrowable;
        qty = parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(decimals));
    }

    // Vérif finale
    if (qty <= 0) {
        throw new Error('Quantité finale invalide après limitation.');
    }

    console.log(`📉 Quantité finale à emprunter : ${qty} ${asset}`);

    // -------------------------------
    // 🏦 4. Emprunt de l'actif
    // -------------------------------
    try {
        console.log(`💼 Emprunt de ${qty} ${asset}...`);

        const borrowResult = await isolatedMarginLoanRaw({
            asset,
            amount: qty.toString(),
            symbol,
            apiKey: process.env.BINANCE_MARGIN_API_KEY,
            apiSecret: process.env.BINANCE_MARGIN_API_SECRET
        });

        console.log('➡️ Emprunt OK :', borrowResult);

    } catch (err) {
        const msg = err.response?.data?.msg || err.message;
        const code = err.response?.data?.code;
        console.error(`❌ Erreur emprunt : ${msg} (code ${code})`);
        throw err;
    }

    // -------------------------------
    // 📉 5. Passage de l’ordre de vente
    // -------------------------------
    let order;

    try {
        console.log('📤 Passage de la vente à découvert...');

        order = await binance.marginOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: qty,
            isIsolated: 'TRUE'
        });

        console.log('📈 Vente effectuée :', order);

    } catch (error) {
        console.error('❌ Erreur lors de la vente :', error.message);

        // Remboursement en cas d’échec
        await binance.marginRepay({
            asset,
            amount: qty,
            isIsolated: 'TRUE',
            symbol
        });

        console.log('🔄 Emprunt remboursé automatiquement.');
        throw error;
    }

    // -------------------------------
    // 🎯 6. SL / TP + Telegram
    // -------------------------------
    const slTp = getSlAndTpLevels(type);
    const entry = parseFloat(order.fills?.[0]?.price) || price;

    const sl = entry * (1 + slTp.stop_loss / 100);
    const tp = entry * (1 - slTp.take_profit / 100);

    const pnlPotential = (entry - tp) * qty;
    const lossPotential = (sl - entry) * qty;

    bot.sendMessage(
        chatId,
        `📉 **Short exécuté sur ${symbol}**\n\n` +
        `• Prix : ${entry} USDC\n` +
        `• Quantité : ${qty}\n` +
        `• Gain potentiel : +${pnlPotential.toFixed(2)} USDC\n` +
        `• Perte potentielle : -${lossPotential.toFixed(2)} USDC\n`
    );

    return { order, initialPrice: entry };
};

module.exports = { takeShortPosition };
