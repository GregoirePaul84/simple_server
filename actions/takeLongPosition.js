const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");

// Fonction pour gérer un achat (position longue)
const takeLongPosition = async(
    binance, 
    symbol, 
    type,
    price, 
    usdcBalance, 
    bot,
    chatId
) => {
    
    // Vérification du solde USDC pour un achat
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour acheter.');
        throw new Error('Solde USDC insuffisant.');
    }
    
    // Définir StepSize et MinQty selon la paire
    let stepSize, minQty;

    if (symbol === 'BTCUSDC') {
        stepSize = 0.00001;
        minQty = 0.00001;
    } else if (symbol === 'DOGEUSDC') {
        stepSize = 0.1;
        minQty = 1;
    } else {
        throw new Error(`StepSize et MinQty non définis pour le symbole : ${symbol}`);
    }

    const decimalPlaces = getDecimalPlaces(stepSize);

    const feeRate = 0.00075;
    const slippage = 0.005;
    const margin = 1 - feeRate - slippage;

    const rawQuantity = (usdcBalance / price) * margin;
    let quantityToBuy = Math.floor(rawQuantity / stepSize) * stepSize;
    quantityToBuy = parseFloat(quantityToBuy.toFixed(decimalPlaces));

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
    
    const slAndTpLevels = getSlAndTpLevels(type);

    // Calcul des niveaux de stop-loss et de take-profit
    const stopLoss = price * (1 - slAndTpLevels.stop_loss / 100); 
    const takeProfit = price * (1 + slAndTpLevels.take_profit / 100);
    
    const potentialGain = (takeProfit - price) * quantityToBuy;
    const potentialLoss = (price - stopLoss) * quantityToBuy;
    
    const initialPrice = parseFloat(order.fills[0]?.price); // Récupère le prix d'exécution
    console.log(`Prix d'entrée enregistré : ${initialPrice}`);

    bot.sendMessage(
        chatId,
        `✅ Ordre d'achat exécuté :
        - Symbole : ${symbol}
        - Prix d'achat: ${price} USDC
        - Capital investi : ${usdcBalance.toFixed(2)} USDC
        - Quantité achetée : ${quantityToBuy} ${symbol === 'BTCUSDC' ? 'BTC' : 'DOGE'}
        - Gain potentiel : +${potentialGain.toFixed(2)} USDC
        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC
        `
    );

    return { order, initialPrice };
}

module.exports = { takeLongPosition };

