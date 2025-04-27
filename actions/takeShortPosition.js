const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");

// Fonction pour gérer un short
const takeShortPosition = async (
    binance,
    symbol,
    type,
    price,
    usdcBalance,
    bot,
    chatId
) => {

    // Vérification du solde USDC pour vendre à découvert
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour vendre à découvert.');
        throw new Error('Solde insuffisant en USDC pour vendre à découvert.');
    }

    // Définir StepSize et MinQty selon la paire
    let stepSize, minQty, loanAsset;

    if (symbol === 'BTCUSDC') {
        stepSize = 0.00001;
        minQty = 0.00001;
        loanAsset = 'BTC';
    } else if (symbol === 'DOGEUSDC') {
        stepSize = 0.1;
        minQty = 1;
        loanAsset = 'DOGE';
    } else {
        throw new Error(`Paramètres non définis pour le symbole : ${symbol}`);
    }

    const decimalPlaces = getDecimalPlaces(stepSize);
    const feeRate = 0.00075; // 0.075% de frais
    const marginForFees = 1 - feeRate;

    // Calcul de la quantité de l'actif à vendre
    let quantityToSell = (usdcBalance / price) * marginForFees;
    quantityToSell = Math.floor(quantityToSell / stepSize) * stepSize;
    quantityToSell = parseFloat(quantityToSell.toFixed(decimalPlaces));

    if (quantityToSell < minQty) {
        throw new Error('La quantité calculée est inférieure au minimum requis.');
    }

    const totalOrderValue = quantityToSell * price;

    if (totalOrderValue < 5) {
        throw new Error('Le montant total de l\'ordre est inférieur au minimum requis de 5 USDC.');
    }

    // Étape 1 : Emprunter des BTC pour vendre à découvert
    try {
        console.log(`Demande d'emprunt de ${quantityToSell} ${loanAsset}.`);

        const loanResponse = await binance.marginLoan({
            asset: loanAsset,
            amount: quantityToSell,
            isIsolated: true,
            symbol,
        });

        console.log(`Emprunt de ${quantityToSell} ${loanAsset} effectué.`, loanResponse);
    } catch (error) {
        console.error('Erreur lors de l\'emprunt :', error.message);
        throw error;
    }

    // Étape 2 : Vendre les BTC empruntés
    let order;
    try {
        console.log('Passage de l\'ordre de vente.');
        
        order = await binance.marginOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: quantityToSell,
            isIsolated: true,
        });

        console.log('Ordre de vente à découvert effectué.', order);
    } catch (error) {
        console.error('Erreur lors de l\'ordre de vente à découvert :', error.message);

        // Si l'ordre échoue, rembourse immédiatement les BTC empruntés
        await binance.marginRepay({
            asset: loanAsset,
            amount: quantityToSell,
            isIsolated: true,
            symbol,
        });

        console.log(`${loanAsset} remboursé après échec de la vente.`);

        throw error;
    }

    // Étape 3 : Calcul des niveaux de stop-loss et de take-profit
    const slAndTpLevels = getSlAndTpLevels(type);

    const stopLoss = price * (1 + slAndTpLevels.stop_loss / 100);
    const takeProfit = price * (1 - slAndTpLevels.take_profit / 100);

    const potentialGain = (price - takeProfit) * quantityToSell;
    const potentialLoss = (stopLoss - price) * quantityToSell;

    const initialPrice = parseFloat(order.fills[0]?.price) || price; // Récupère le prix d'exécution
    console.log(`Prix d'entrée enregistré : ${initialPrice}`);

    // Notification Telegram
    bot.sendMessage(
        chatId,
        `✅ Ordre de vente à découvert exécuté :
        - Symbole : ${symbol}
        - Prix de vente: ${price} USDC
        - Capital investi : ${usdcBalance.toFixed(2)} USDC
        - Quantité vendue: ${quantityToSell}
        - Gain potentiel : +${potentialGain.toFixed(2)} USDC
        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC
        `
    );

    return { order, initialPrice };
};


module.exports = { takeShortPosition };
