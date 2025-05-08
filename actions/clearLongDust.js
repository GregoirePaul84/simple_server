const { getBalanceData } = require("../getBalanceData");

async function clearLongDust(symbol, binanceMargin) {
    let balanceData = await getBalanceData(symbol); // Récupère le solde après la clôture
    const btcRemaining = parseFloat(balanceData.baseAsset.free);

    if (btcRemaining > 0.00001) { // Vérifie s'il reste un montant tradable
        console.log(`Liquidation des résidus BTC après un LONG : ${btcRemaining}`);
        
        try {
            await binanceMargin.orderMarketSell({
                symbol: 'BTCUSDC',
                quantity: btcRemaining
            });
            console.log("Résidus BTC vendus avec succès.");
        } catch (error) {
            console.error("Erreur lors de la liquidation des résidus :", error);
        }
    } else {
        console.log('Pas de résidus à nettoyer à la clôture du long.');
    }
}

module.exports = { clearLongDust };