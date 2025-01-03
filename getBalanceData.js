const { getIsolatedMarginAccount } = require('./getIsolatedMarginAccount');

const getBalanceData = async() => {
    // Récupération du solde pour le portefeuille de marge isolée
    const marginAccount = await getIsolatedMarginAccount(
        process.env.BINANCE_API_KEY,
        process.env.BINANCE_API_SECRET
    );

    // Balances pour BTC et USDC
    const btcUsdcData = marginAccount.assets.find(asset => asset.symbol === 'BTCUSDC');

    if (!btcUsdcData) {
        throw new Error('La paire BTCUSDC n\'a pas été trouvée dans le portefeuille isolé.');
    }

    return btcUsdcData;
}

module.exports = { getBalanceData }