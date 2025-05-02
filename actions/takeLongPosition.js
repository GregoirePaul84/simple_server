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
    
    console.log(`Achat commencé pour ${symbol}`);
    
    // Vérification du solde USDC pour un achat
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour acheter.');
        throw new Error('Solde USDC insuffisant.');
    }
    
    console.log(`Balance disponible => ${usdcBalance} USDC`);
    
    const exchangeInfo = await binance.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    const minQty = parseFloat(lotSizeFilter.minQty);
    const decimalPlaces = getDecimalPlaces(stepSize);

    // Étape 1 : quantité brute
    const grossQuantity = usdcBalance / price;

    // Étape 2 : réduction marge
    const slippage = 0.01;
    const feeRate = 0.00075;
    const margin = 1 - feeRate - slippage;
    let quantityToBuy = grossQuantity * margin;

    // Étape 3 : arrondi au stepSize
    quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
    quantityToBuy = parseFloat(quantityToBuy.toFixed(decimalPlaces));

    // Étape 3 : arrondi au stepSize
    quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
    quantityToBuy = parseFloat(quantityToBuy.toFixed(decimalPlaces));

    // Étape 4 : vérification minQty
    if (quantityToBuy < minQty) {
        throw new Error(`Quantité trop faible. Minimum requis pour ${symbol} : ${minQty}`);
    }
    
    console.log(`Quantité ajustée : ${quantityToBuy} à ${price} USDC`);    

    // Étape 5 : vérification valeur minimale (minNotional)
    const notionalFilter = symbolInfo.filters.find(f => f.filterType === 'NOTIONAL');
    const minNotional = parseFloat(notionalFilter.minNotional);

    const totalOrderValue = quantityToBuy * price;

    console.log(`coût total => ${totalOrderValue} USDC`);
    
    if (totalOrderValue < minNotional) {
        throw new Error(`Valeur de l'ordre trop faible. Minimum requis : ${minNotional} USDC.`);
    }

    console.log({
        usdcBalance,
        quantityToBuy,
        stepSize,
        minQty,
        totalOrderValue: quantityToBuy * price,
        minNotional
      });      
    
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

