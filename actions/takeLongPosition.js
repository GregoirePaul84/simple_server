// Fonction pour gérer un achat (position longue)
const takeLongPosition = async(binance, symbol, price, usdcBalance, hasOpenLongPosition, lastBuyPrice, bot, chatId) => {

    // Vérifie qu'un ordre n'est pas en cours
    const openOrders = await binance.openOrders(symbol);
    if (openOrders.length > 0) {
        console.error(`Une position est déjà ouverte pour ${symbol}.`);
        throw new Error(`Une position est déjà ouverte pour ${symbol}.`);
    }

    // Vérification du solde USDC pour un achat
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour acheter.');
        throw new Error('Solde USDC insuffisant.');
    }
    
    const quantityToBuy = (usdcBalance / price).toFixed(6);
    
    // ATTENTION : la ligne suivante interagit avec Binance
    const order = await binance.marketBuy(symbol, quantityToBuy);
    console.log('Prise de position longue.', order);
    
    // Calcul des niveaux de stop-loss et de take-profit
    const stopLoss = price * (1 - 5.0 / 100); 
    const takeProfit = price * (1 + 8.7 / 100);
    
    const potentialGain = (takeProfit - price) * quantityToBuy;
    const potentialLoss = (price - stopLoss) * quantityToBuy;
    
    hasOpenLongPosition = true;
    lastBuyPrice = price;

    bot.sendMessage(
        chatId,
        `✅ Ordre d'achat exécuté :
        - Symbole : ${symbol}
        - Capital investi : ${usdcBalance.toFixed(2)} USDC
        - Quantité achetée : ${quantityToBuy} BTC
        - Gain potentiel : +${potentialGain.toFixed(2)} USDC
        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC
        `
    );
}

module.exports = { takeLongPosition };

