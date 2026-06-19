require('dotenv').config();
const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { rawBorrowRepay } = require('../rawBorrowRepay');
const { getMaxBorrowable } = require('../getMaxBorrowable');

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

    // 1. Règles du marché
    const exchangeInfo = await binance.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

    const lot = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    const stepSize = parseFloat(lot.stepSize);
    const minQty = parseFloat(lot.minQty);
    const decimals = getDecimalPlaces(stepSize);

    const asset = symbol.replace('USDC', '');

    // 2. Quantité max empruntable via l'endpoint officiel Binance (par paire isolée)
    const maxBorrowable = await getMaxBorrowable(asset, symbol);
    console.log(`📊 Max empruntable Binance pour ${asset} sur ${symbol} : ${maxBorrowable}`);

    if (maxBorrowable <= 0) {
        throw new Error(`Capacité d'emprunt nulle selon Binance pour ${asset} sur ${symbol}.`);
    }

    const feeRate = 0.001;
    let qty = (usdcBalance / price) * (1 - feeRate);
    qty = Math.min(qty, maxBorrowable * 0.98); // 2% buffer de sécurité
    qty = Math.floor(qty / stepSize) * stepSize;
    qty = parseFloat(qty.toFixed(decimals));

    if (qty < minQty) {
        throw new Error(`Quantité trop faible : ${qty}`);
    }

    console.log(`🔢 Quantité à shorter : ${qty} ${asset}`);

    // 3. Emprunt
    try {
        await rawBorrowRepay({
            asset,
            symbol,
            amount: qty,
            type: 'BORROW',
            apiKey: process.env.BINANCE_MARGIN_API_KEY,
            apiSecret: process.env.BINANCE_MARGIN_API_SECRET
        });
        console.log(`✅ Emprunt de ${qty} ${asset} OK`);
    } catch (err) {
        console.error(`❌ Erreur emprunt :`, err.message, '(code', err.code, ')');
        throw err;
    }

    // 4. Vente de l'actif emprunté
    let order;
    try {
        console.log(`📤 Vente à découvert de ${qty} ${asset}...`);
        order = await binance.marginOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: qty,
            isIsolated: 'TRUE'
        });
        console.log('📈 Short ouvert :', order);
    } catch (error) {
        console.error('❌ Erreur lors de la vente :', error.message);
        await rawBorrowRepay({
            asset, symbol, amount: qty, type: 'REPAY',
            apiKey: process.env.BINANCE_MARGIN_API_KEY,
            apiSecret: process.env.BINANCE_MARGIN_API_SECRET
        }).catch(e => console.error('Repay auto échoué:', e.message));
        throw error;
    }

    // 5. SL / TP + Telegram
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
