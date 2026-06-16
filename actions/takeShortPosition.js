require('dotenv').config();
const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");

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

    // 2. Calcul de la quantité à shorter
    const feeRate = 0.001;
    let qty = (usdcBalance / price) * (1 - feeRate);
    qty = Math.floor(qty / stepSize) * stepSize;
    qty = parseFloat(qty.toFixed(decimals));

    if (qty < minQty) {
        throw new Error(`Quantité trop faible : ${qty}`);
    }

    console.log(`🔢 Quantité à shorter : ${qty} ${asset}`);

    // 3. Vente à découvert avec emprunt automatique
    // sideEffectType: 'MARGIN_BUY' demande à Binance d'emprunter l'actif automatiquement
    // avant la vente, en évitant l'appel explicite à /margin/loan qui retourne -11007.
    let order;
    try {
        console.log(`📤 Vente à découvert avec auto-borrow de ${qty} ${asset}...`);

        order = await binance.marginOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: qty,
            isIsolated: 'TRUE',
            sideEffectType: 'MARGIN_BUY'
        });

        console.log('📈 Short ouvert :', order);

    } catch (error) {
        console.error('❌ Erreur lors de la vente à découvert :', error.message, '(code', error.code, ')');
        throw error;
    }

    // 4. SL / TP + Telegram
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
