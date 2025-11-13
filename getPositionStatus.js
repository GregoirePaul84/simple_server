// positionStatus.js
const { getIsolatedMarginAccount } = require('./getIsolatedMarginAccount');

const MIN_NOTIONAL_USD = 5; // seuil à partir duquel on considère que c'est une vraie position

async function getPositionStatus(symbol, price) {
    const account = await getIsolatedMarginAccount(
        process.env.BINANCE_MARGIN_API_KEY,
        process.env.BINANCE_MARGIN_API_SECRET
    );

    const pair = account.assets.find(a => a.symbol === symbol);
    if (!pair) {
        throw new Error(`Paire ${symbol} introuvable dans le portefeuille isolé.`);
    }

    const baseFree   = parseFloat(pair.baseAsset.free);
    const baseLocked = parseFloat(pair.baseAsset.locked);
    const baseBorrow = parseFloat(pair.baseAsset.borrowed);

    const netLongQty  = baseFree + baseLocked;   // ce que je DÉTIENS
    const netShortQty = baseBorrow;              // ce que je DOIS

    const longNotional  = netLongQty  * price;
    const shortNotional = netShortQty * price;

    const hasLong  = longNotional  > MIN_NOTIONAL_USD;
    const hasShort = shortNotional > MIN_NOTIONAL_USD;

    return {
        hasOpenPosition: hasLong || hasShort,
        hasLong,
        hasShort,
        longNotional,
        shortNotional,
    };
}

module.exports = { getPositionStatus };
