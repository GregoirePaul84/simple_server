// Fonction pour gérer un short
const takeShortPosition = async (
    binance,
    symbol,
    price,
    usdcBalance,
    bot,
    chatId
) => {
    console.log('LE BOT ===>', bot);

    // Vérification du solde USDC pour vendre à découvert
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour vendre à découvert.');
        throw new Error('Solde insuffisant en USDC pour vendre à découvert.');
    }

    const stepSize = 0.00001; // StepSize pour BTCUSDC
    const minQty = 0.00001; // Quantité minimale
    const feeRate = 0.00075; // 0.075% frais par transaction
    const marginForFees = 1 - feeRate; // Ajustement pour les frais

    // Calcul de la quantité de BTC à emprunter en fonction du solde USDC
    let quantityToSell = (usdcBalance / price) * marginForFees; // Ajuster pour les frais
    quantityToSell = (quantityToSell / 2); // Diviser par deux pour limiter l'emprunt
    quantityToSell = (Math.floor(quantityToSell / stepSize) * stepSize).toFixed(5); // Ajustement au stepSize

    if (quantityToSell < minQty) {
        throw new Error('La quantité calculée est inférieure au minimum requis.');
    }

    const totalOrderValue = quantityToSell * price;

    if (totalOrderValue < 5) {
        throw new Error('Le montant total de l\'ordre est inférieur au minimum requis de 5 USDC.');
    }

    // Étape 1 : Emprunter des BTC pour vendre à découvert
    try {
        console.log(`Emprunt de ${quantityToSell} BTC effectué pour ${symbol}.`);

        const loanResponse = await binance.marginLoan({
            asset: 'BTC',
            amount: quantityToSell,
            isIsolated: true,
            symbol,
        });
        console.log(`Emprunt de ${quantityToSell} BTC effectué pour ${symbol}.`, loanResponse);
    } catch (error) {
        console.error('Erreur lors de l\'emprunt de BTC :', error.message);
        throw error;
    }

    // Étape 2 : Vendre les BTC empruntés
    let order;
    try {
        console.log('ordre à découvert effectué test');
        
        order = await binance.marginOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: quantityToSell,
            isIsolated: true, // Spécifie la marge isolée
        });
        console.log('Ordre de vente à découvert effectué.', order);
    } catch (error) {
        console.error('Erreur lors de l\'ordre de vente à découvert :', error.message);

        // Si l'ordre échoue, rembourse immédiatement les BTC empruntés
        await binance.marginRepay({
            asset: 'BTC',
            amount: quantityToSell,
            isIsolated: true,
            symbol,
        });
        console.log(`BTC remboursés après échec de l'ordre.`);
        throw error;
    }

    // Étape 3 : Calcul des niveaux de stop-loss et de take-profit
    const stopLoss = price * (1 + 5.0 / 100); // 5% au-dessus du prix de vente
    const takeProfit = price * (1 - 8.7 / 100); // 8.7% en dessous du prix de vente

    // Calcul du gain et de la perte potentiels
    const potentialGain = (price - takeProfit) * quantityToSell; // Gain potentiel
    const potentialLoss = (stopLoss - price) * quantityToSell; // Perte potentielle

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
