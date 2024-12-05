// Fonction pour gérer un short
const takeShortPosition = async(binance, symbol, price, usdcBalance, hasOpenShortPosition, lastSellPrice, shortQuantity, bot, chatId) => {

    // Test local
    // usdcBalance = 0;

    // Vérifie qu'un ordre n'est pas en cours
    const openOrders = await binance.openOrders(symbol);
    if (openOrders.length > 0) {
        console.error(`Une position est déjà ouverte pour ${symbol}.`);
        throw new Error(`Une position est déjà ouverte pour ${symbol}.`);
    }

    // Vérification du solde USDC pour vendre à découvert
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour vendre à découvert.');
        throw new Error('Solde insuffisant en USDC pour vendre à découvert.');
    }

    const quantityToSell = (usdcBalance / price).toFixed(6);

    // ATTENTION : la ligne suivante interagit avec Binance
    // const order = await binance.marketSell(symbol, quantityToSell);
    console.log('Ordre de vente à découvert effectué.');

    // Calcul des niveaux de stop-loss et de take-profit
    const stopLoss = price * (1 + 5.0 / 100); 
    const takeProfit = price * (1 - 8.7 / 100);

    // Calcul du gain et de la perte potentiels
    const potentialGain = (price - takeProfit) * quantityToSell; // Gain potentiel
    const potentialLoss = (stopLoss - price) * quantityToSell; // Perte potentielle

    hasOpenShortPosition = true; // Une position short est ouverte
    lastSellPrice = price; // Prix de la position
    shortQuantity = quantityToSell; 

    bot.sendMessage(
        chatId,
        `✅ Ordre de vente à découvert exécuté :
        - Symbole : ${symbol}
        - Capital investi : ${usdcBalance.toFixed(2)} USDC
        - Quantité vendue: ${quantityToSell}
        - Gain potentiel : +${potentialGain.toFixed(2)} USDC
        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC
        `
    );  
}

module.exports = { takeShortPosition };
