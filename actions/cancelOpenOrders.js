
const cancelOpenOrders = async (binance, symbol) => {
    try {
        const openOrders = await binance.marginOpenOrders({ symbol, isIsolated: true });
        if (openOrders.length === 0) {
            console.log(`Aucun ordre ouvert trouvé pour ${symbol}.`);
            return;
        }

        for (const order of openOrders) {
            await binance.cancelMarginOrder({
                symbol,
                orderId: order.orderId,
                isIsolated: true,
            });
            console.log(`Ordre ${order.orderId} annulé pour ${symbol}.`);
        }
    } catch (error) {
        console.error(`Erreur lors de l'annulation des ordres ouverts pour ${symbol} :`, error.message);
        throw error;
    }
};


module.exports = { cancelOpenOrders };