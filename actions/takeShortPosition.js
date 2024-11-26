// Fonction pour gérer un short
const takeShortPosition = async(binance, symbol, price, usdcBalance, hasOpenShortPosition, lastSellPrice, shortQuantity) => {

    // Vérifie qu'un ordre n'est pas en cours
    const openOrders = await binance.openOrders(symbol);
    if (openOrders.length > 0) {
        console.error(`Une position est déjà ouverte pour ${symbol}.`);
        return res.status(400).send('Position déjà ouverte.');
    }

    // Vérification du solde USDC pour vendre à découvert
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour vendre à découvert.');
        return res.status(400).send('Solde USDC insuffisant.');
    }

    const quantityToSell = (usdcBalance / price).toFixed(6);

    // ATTENTION : la ligne suivante interagit avec Binance
    // const order = await binance.marketSell(symbol, quantityToSell);
    // console.log('Ordre de vente à découvert effectué.', order);

    const stopLoss = price * 0.95;
    const takeProfit = price * 1.087
    const potentialGain = price - takeProfit;
    const potentialLoss = price - stopLoss;

    hasOpenShortPosition = true; // Une position short est ouverte
    lastSellPrice = price; // Prix de la position
    shortQuantity = quantityToSell; 

    bot.sendMessage(
        chatId,
        `✅ Ordre de vente à découvert exécuté :
        - Symbole : ${symbol}
        - Quantité : ${quantityToSell}
        - Prix : ${price} USDC 
        - Gain potentiel : ${potentialGain} USDC
        - Perte potentielle : ${potentialLoss} USDC
        `
    );  
}

module.exports = { takeShortPosition };
