// Fonction pour gérer un short
const takeShortPosition = async(
    binance, 
    symbol, 
    price, 
    usdcBalance, 
    hasOpenShortPosition, 
    lastSellPrice, 
    shortQuantity, 
    bot, 
    chatId
) => {

    // Vérification du solde USDC pour vendre à découvert
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour vendre à découvert.');
        throw new Error('Solde insuffisant en USDC pour vendre à découvert.');
    }

    const stepSize = 0.00001; // StepSize pour BTCUSDC
    const minQty = 0.00001; // Quantité minimale

    // Calcul et ajustement de la quantité
    let quantityToSell = (usdcBalance / price).toFixed(8); // Calcul initial
    quantityToSell = Math.floor(quantityToSell / stepSize) * stepSize; // Ajustement au stepSize

    if (quantityToSell < minQty) {
        throw new Error('La quantité calculée est inférieure au minimum requis.');
    }

    const totalOrderValue = quantityToSell * price;

    if (totalOrderValue < 5) {
        throw new Error('Le montant total de l\'ordre est inférieur au minimum requis de 5 USDC.');
    }

    // Étape 1 : Emprunter des BTC pour vendre à découvert
    const loanResponse = await binance.marginLoan({
        asset: 'BTC',
        amount: quantityToSell,
        isIsolated: true,
        symbol,
    });
    console.log(`Emprunt de ${quantityToSell} BTC effectué pour ${symbol}.`, loanResponse);

    // Étape 2 : Vendre les BTC empruntés
    const order = await binance.marginOrder({
        symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: quantityToSell,
        isIsolated: true, // Spécifie la marge isolée
    });
    
    console.log('Ordre de vente à découvert effectué.', order);

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

    return order;
}

module.exports = { takeShortPosition };
