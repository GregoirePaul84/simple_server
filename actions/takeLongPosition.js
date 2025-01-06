// Fonction pour gérer un achat (position longue)
const takeLongPosition = async(
    binance, 
    symbol, 
    price, 
    usdcBalance, 
    hasOpenLongPosition, 
    lastBuyPrice,
    bot,
    chatId
) => {
    
    // Vérification du solde USDC pour un achat
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour acheter.');
        throw new Error('Solde USDC insuffisant.');
    }
    
    const stepSize = 0.00001; // StepSize pour BTCUSDC
    const minQty = 0.00001; // Quantité minimale

    // Calcul de la quantité ajustée
    let quantityToBuy = Math.floor((usdcBalance / price) / stepSize) * stepSize;
    quantityToBuy = parseFloat(quantityToBuy.toFixed(5));

    if (quantityToBuy < minQty) {
        throw new Error('La quantité calculée est inférieure au minimum requis.');
    }

    console.log(`Quantité ajustée : ${quantityToBuy}`);

    const totalOrderValue = quantityToBuy * price;

    if (totalOrderValue < 5) {
        throw new Error('Le montant total de l\'ordre est inférieur au minimum requis de 5 USDC.');
    }
    
    // ACHAT
    const order = await binance.marginOrder({
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity: quantityToBuy,
        isIsolated: true,
    });

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

    return order;
}

module.exports = { takeLongPosition };

