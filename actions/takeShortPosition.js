require('dotenv').config();
const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { getMaxBorrowable } = require('../getMaxBorrowable');
const { isolatedMarginLoanRaw } = require('../isolatedMarginLoanRaw');
const { getIsolatedMarginAccount } = require('../getIsolatedMarginAccount');

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
    // 0.9 safety factor: keeps ML ~2.11 instead of ~2.001, avoiding -11007 when price
    // moves between webhook price fetch and the actual borrow call.
    const leverageFactor = 0.9;
    let qty = (usdcBalance * leverageFactor / price) * (1 - feeRate);
    qty = Math.floor(qty / stepSize) * stepSize;
    qty = parseFloat(qty.toFixed(decimals));

    if (qty < minQty) {
        throw new Error(`Quantité trop faible : ${qty}`);
    }

    console.log(`🔢 Quantité demandée : ${qty}`);

    // -------------------------------
    // 🔐 3. Vérification du max borrow réel
    // -------------------------------

    const maxBorrowable = await getMaxBorrowable(asset, symbol);

    console.log(`📊 Max empruntable selon Binance : ${maxBorrowable}`);
    console.log(`🔍 Debug: qty=${qty}, maxBorrowable=${maxBorrowable}, qtyEstSupérieur=${qty > maxBorrowable}`);

    if (!isFinite(maxBorrowable) || maxBorrowable <= 0) {
        throw new Error(`Montant empruntable invalide pour ${symbol}: ${maxBorrowable}`);
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
    // 🔍 3b. Diagnostic état de la paire avant emprunt
    // -------------------------------
    const marginAccount = await getIsolatedMarginAccount(
        process.env.BINANCE_MARGIN_API_KEY,
        process.env.BINANCE_MARGIN_API_SECRET
    );
    const pair = marginAccount.assets.find(a => a.symbol === symbol);
    if (pair) {
        console.log(`🔍 État BTCUSDC baseAsset:`, JSON.stringify(pair.baseAsset));
        console.log(`🔍 État BTCUSDC quoteAsset:`, JSON.stringify(pair.quoteAsset));
        console.log(`🔍 marginLevel: ${pair.marginLevel}, marginLevelStatus: ${pair.marginLevelStatus}`);
    }

    // -------------------------------
    // 🏦 4. Emprunt de l'actif
    // -------------------------------
    try {
        console.log(`💼 Emprunt de ${qty} ${asset}...`);

        const borrowResult = await isolatedMarginLoanRaw({
            asset,
            amount: qty,
            symbol,
            apiKey: process.env.BINANCE_MARGIN_API_KEY,
            apiSecret: process.env.BINANCE_MARGIN_API_SECRET
        });

        console.log('➡️ Emprunt OK :', borrowResult);

    } catch (err) {
        const msg = err.message;
        const code = err.code;
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
