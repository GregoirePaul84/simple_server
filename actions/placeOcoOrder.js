const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");

const placeOCOOrder = async (binance, symbol, type, side, price, assetsAvailable, bot, chatId) => {
    try {

        console.log(`ordre OCO débuté pour ${symbol}`);
        
        if (assetsAvailable <= 0) {
            throw new Error('Quantité insuffisante pour passer un ordre OCO.');
        }
        
        const slAndTpLevels = getSlAndTpLevels(type);

        // Calcul des prix
        const takeProfitPrice = side === 'BUY' 
            ? price * (1 + slAndTpLevels.take_profit / 100) 
            : price * (1 - slAndTpLevels.take_profit / 100); 

        const stopLossPrice = side === 'BUY' 
            ? price * (1 - slAndTpLevels.stop_loss / 100) 
            : price * (1 + slAndTpLevels.stop_loss / 100); 

        const stopLimitPrice = side === 'BUY' 
            ? stopLossPrice * 0.99 // Ajustement limite pour LONG
            : stopLossPrice * 1.01; // Ajustement limite pour SHORT

        console.log('Take Profit Price :', takeProfitPrice.toFixed(2));
        console.log('Stop Loss Price :', stopLossPrice.toFixed(2));
        console.log('Stop Limit Price :', stopLimitPrice.toFixed(2));

        // Récupération des données pour le symbole
        const exchangeInfo = await binance.exchangeInfo();
        const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        const minQty = parseFloat(lotSizeFilter.minQty);
        const decimalPlaces = getDecimalPlaces(stepSize);

        let adjustedQuantity = Math.floor(assetsAvailable / stepSize) * stepSize;
        adjustedQuantity = parseFloat(adjustedQuantity.toFixed(decimalPlaces));

        if (adjustedQuantity < minQty) {
            throw new Error(`Quantité trop faible pour ${symbol}. Minimum requis : ${minQty}`);
        }

        const finalQuantity = adjustedQuantity.toFixed(decimalPlaces);

        console.log('Quantité finale ajustée =>', finalQuantity);

        const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');
        const tickSize = parseFloat(priceFilter.tickSize);
        const priceDecimalPlaces = getDecimalPlaces(tickSize);

        // Passer l'ordre OCO
        const ocoOrder = await binance.marginOrderOco({
            symbol,
            side: side === 'BUY' ? 'SELL' : 'BUY', // Si on a acheté, on vend pour clôturer
            quantity: finalQuantity,        // Quantité arrondie
            price: takeProfitPrice.toFixed(priceDecimalPlaces),    // Prix du Take Profit
            stopPrice: stopLossPrice.toFixed(priceDecimalPlaces),  // Prix du Stop Loss
            stopLimitPrice: stopLimitPrice.toFixed(priceDecimalPlaces), // Prix limite du Stop Loss
            stopLimitTimeInForce: 'GTC',          // Good 'Til Cancelled
            isIsolated: true,                     // Utilisation du portefeuille isolé
        });

        console.log('Ordre OCO passé avec succès :', ocoOrder);

        bot.sendMessage(
            chatId,
            `✅ Ordre OCO ajusté :
            - Take profit : ${takeProfitPrice.toFixed(priceDecimalPlaces)} USDC
            - Stop loss : ${stopLossPrice.toFixed(priceDecimalPlaces)} USDC
            - Stop limite : ${stopLimitPrice.toFixed(priceDecimalPlaces)} USDC
            `
        );
    } catch (error) {
        console.error('Erreur lors du passage de l\'ordre OCO :', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { placeOCOOrder };
