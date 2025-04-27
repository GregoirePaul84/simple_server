const { getIsolatedMarginAccount } = require('./getIsolatedMarginAccount');

const getBalanceData = async(symbol) => {
    // Récupération du solde pour le portefeuille de marge isolée
    const marginAccount = await getIsolatedMarginAccount(
        process.env.BINANCE_MARGIN_API_KEY,
        process.env.BINANCE_MARGIN_API_SECRET
    );

    // Balances pour BTC / USDC ou DOGE / USDC
    const balanceData = marginAccount.assets.find(asset => asset.symbol === symbol);

    if (!balanceData) {
        throw new Error(`La paire ${balanceData} n\'a pas été trouvée dans le portefeuille isolé.`);
    }

    return balanceData;
}

module.exports = { getBalanceData }