const placeOCOOrder = async (binance, symbol, side, price, btcBalance, bot, chatId) => {
    try {

        if (btcBalance <= 0) {
            throw new Error('Quantité insuffisante pour passer un ordre OCO.');
        }
        
        // Calcul du Take Profit et Stop Loss
        const stopLossPercentLong = 5.38; // Stop Loss pour LONG
        const takeProfitPercentLong = 8.62; // Take Profit pour LONG
        const stopLossPercentShort = 5.6; // Stop Loss pour SHORT
        const takeProfitPercentShort = 9.03; // Take Profit pour SHORT

        // Calcul des prix
        const takeProfitPrice = side === 'BUY' 
            ? price * (1 + takeProfitPercentLong / 100) // +8.7% pour LONG
            : price * (1 - takeProfitPercentShort / 100); // -8.9% pour SHORT

        const stopLossPrice = side === 'BUY' 
            ? price * (1 - stopLossPercentLong / 100) // -5.3% pour LONG
            : price * (1 + stopLossPercentShort / 100); // +5.4% pour SHORT

        const stopLimitPrice = side === 'BUY' 
            ? stopLossPrice * 0.99 // Ajustement limite pour LONG
            : stopLossPrice * 1.01; // Ajustement limite pour SHORT

        console.log('Take Profit Price :', takeProfitPrice.toFixed(2));
        console.log('Stop Loss Price :', stopLossPrice.toFixed(2));
        console.log('Stop Limit Price :', stopLimitPrice.toFixed(2));

        const stepSize = 0.00001; // Ajustement selon les règles de la paire
        const adjustedQuantity = Math.floor(btcBalance / stepSize) * stepSize; // Ajuster au stepSize
        const finalQuantity = adjustedQuantity.toFixed(5); // Garantir 5 décimales

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
