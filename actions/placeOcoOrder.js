const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");

const placeOCOOrder = async (binance, symbol, type, side, price, assetsAvailable, bot, chatId) => {
    try {

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

        let stepSize;

        if (symbol === 'BTCUSDC') {
            stepSize = 0.00001;
        } else if (symbol === 'DOGEUSDC') {
            stepSize = 0.1;
        } else {
            throw new Error(`StepSize non défini pour le symbole : ${symbol}`);
        }
        
        const adjustedQuantity = Math.floor(assetsAvailable / stepSize) * stepSize; // Ajuster au stepSize

        const decimalPlaces = getDecimalPlaces(stepSize);

        const finalQuantity = adjustedQuantity.toFixed(decimalPlaces);

        console.log('Quantité finale ajustée =>', finalQuantity);

        // Passer l'ordre OCO
        const ocoOrder = await binance.marginOrderOco({
            symbol,
            side: side === 'BUY' ? 'SELL' : 'BUY', // Si on a acheté, on vend pour clôturer
            quantity: finalQuantity,        // Quantité arrondie
            price: takeProfitPrice.toFixed(2),    // Prix du Take Profit
            stopPrice: stopLossPrice.toFixed(2),  // Prix du Stop Loss
            stopLimitPrice: stopLimitPrice.toFixed(2), // Prix limite du Stop Loss
            stopLimitTimeInForce: 'GTC',          // Good 'Til Cancelled
            isIsolated: true,                     // Utilisation du portefeuille isolé
        });

        console.log('Ordre OCO passé avec succès :', ocoOrder);

        bot.sendMessage(
            chatId,
            `✅ Ordre OCO ajusté :
            - Take profit : ${takeProfitPrice.toFixed(2)} USDC
            - Stop loss : ${stopLossPrice.toFixed(2)} USDC
            - Stop limite : ${stopLimitPrice.toFixed(2)} USDC
            `
        );
    } catch (error) {
        console.error('Erreur lors du passage de l\'ordre OCO :', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { placeOCOOrder };
