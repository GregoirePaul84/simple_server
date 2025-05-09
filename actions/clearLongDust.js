const { getBalanceData } = require("../getBalanceData");

async function clearLongDust(symbol, binanceMargin) {
    let balanceData = await getBalanceData(symbol); // Récupère le solde après la clôture
    const assetsRemaining = parseFloat(balanceData.baseAsset.free);

    if (assetsRemaining > 0.00001) { // Vérifie s'il reste un montant tradable
        console.log(`Liquidation des résidus après un LONG ${symbol} : ${assetsRemaining}`);
        
        try {
            await binanceMargin.marginOrder({
                symbol,
                side: 'SELL',
                type: 'MARKET',
                quantity: assetsRemaining,
                isIsolated: true,
            });
            console.log(`Résidus vendus avec succès pour ${symbol}.`);
        } catch (error) {
            console.error("Erreur lors de la liquidation des résidus :", error);
        }
    } else {
        console.log('Pas de résidus à nettoyer à la clôture du long.');
    }
}

module.exports = { clearLongDust };