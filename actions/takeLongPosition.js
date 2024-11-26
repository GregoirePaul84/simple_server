// Fonction pour gérer un achat (position longue)
const takeLongPosition = async(binance, symbol, price, usdcBalance, hasOpenLongPosition, lastBuyPrice) => {

    // Vérifie qu'un ordre n'est pas en cours
    const openOrders = await binance.openOrders(symbol);
    if (openOrders.length > 0) {
        console.error(`Une position est déjà ouverte pour ${symbol}.`);
        return res.status(400).send('Position déjà ouverte.');
    }

    // Vérification du solde USDC pour un achat
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour acheter.');
        return res.status(400).send('Solde USDC insuffisant.');
    }

    const quantityToBuy = (usdcBalance / price).toFixed(6);

    // ATTENTION : la ligne suivante interagit avec Binance
    // const order = await binance.marketBuy(symbol, quantityToBuy);
    // console.log('Prise de position longue :', order);
    
    const stopLoss = price * 0.95;
    const takeProfit = price * 1.087
    const potentialGain = takeProfit - price;
    const potentialLoss = stopLoss - price;
    
    hasOpenLongPosition = true;
    lastBuyPrice = price;

    bot.sendMessage(
        chatId,
        `✅ Ordre d'achat exécuté :
        - Symbole : ${symbol}
        - Quantité : ${quantityToBuy}
        - Prix : ${price} USDC 
        - Gain potentiel : ${potentialGain} USDC
        - Perte potentielle : ${potentialLoss} USDC
        `
    );
}

module.exports = { takeLongPosition };

