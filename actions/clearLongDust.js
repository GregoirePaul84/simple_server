const { getBalanceData } = require("../getBalanceData");
const { getDecimalPlaces } = require("../getDecimalPlaces");

async function clearLongDust(symbol, binanceMargin) {
    try {
        // Récupérer les soldes après la clôture
        const balanceData = await getBalanceData(symbol);
        const assetsRemaining = parseFloat(balanceData.baseAsset.free);

        // Récupérer les contraintes de lot size (stepSize / minQty)
        const exchangeInfo = await binanceMargin.exchangeInfo();
        const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const minQty = parseFloat(lotSizeFilter.minQty);
        const decimalPlaces = getDecimalPlaces(stepSize);

        // Arrondi correct à la décimale autorisée
        let adjustedQty = Math.floor(assetsRemaining / stepSize) * stepSize;
        adjustedQty = parseFloat(adjustedQty.toFixed(decimalPlaces));

        if (adjustedQty >= minQty) {
            console.log(`💡 Liquidation des résidus après un LONG ${symbol} : ${adjustedQty}`);

            await binanceMargin.marginOrder({
                symbol,
                side: 'SELL',
                type: 'MARKET',
                quantity: adjustedQty,
                isIsolated: true,
            });

            console.log(`✅ Résidus vendus avec succès pour ${symbol}.`);
        } else {
            console.log(`⚠️ Quantité trop faible pour liquidation : ${adjustedQty} < minQty (${minQty})`);
        }
    } catch (error) {
        console.error("❌ Erreur lors de la liquidation des résidus :", error.response?.data || error.message);
    }
}

module.exports = { clearLongDust };
