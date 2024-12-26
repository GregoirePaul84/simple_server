const { getGainMessage, getLossMessage } = require('../botmessages');

// Fonction pour gérer une vente
const handleCloseShort = async(
    binance, 
    symbol, 
    price, 
    usdcBalance, 
    hasOpenShortPosition, 
    lastSellPrice, 
    initialCapital, 
    shortQuantity, 
    totalProfitCumulative, 
    totalProfitMonthly, 
    bot, 
    chatId
) => {

    // Vérification qu'une position courte existe
    if (!hasOpenShortPosition || !shortQuantity || shortQuantity <= 0) {
        console.error('Pas de position courte ouverte. Clôture non autorisé.');
        throw new Error('Pas de position courte ouverte. Clôture non autorisé.');
    }

    // Racheter les actifs empruntés (BTC)
    const order = await binance.marginOrder({
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity: shortQuantity,
        isIsolated: true, // Spécifie que c'est une opération de marge isolée
    });

    console.log('Ordre d\'achat pour clôturer le short effectué.', order);

    // Rembourser les BTC empruntés
    await binance.marginRepay({
        asset: 'BTC',
        amount: shortQuantity,
        isIsolated: true,
        symbol,
    });
    
    console.log(`Remboursement de ${shortQuantity} BTC effectué.`);

    if (lastSellPrice) {
        const profit = ((lastSellPrice - price) * shortQuantity).toFixed(2); // Profit ou perte de la transaction en USDC
        const profitPercentage = (((lastSellPrice - price) / lastSellPrice) * 100).toFixed(2); // Pourcentage de la transaction

        totalProfitCumulative += parseFloat(profit); // Profit cumulé depuis le début
        totalProfitMonthly += parseFloat(profit); // Profit cumulé depuis le mois

        const totalProfitCumulativePercentage = ((totalProfitCumulative / initialCapital) * 100).toFixed(2); // Pourcentage cumulé depuis le début
        const totalProfitMonthlyPercentage = ((totalProfitMonthly / initialCapital) * 100).toFixed(2); // Pourcentage cumulé depuis le mois

        const minusOrPlusCumulative = totalProfitCumulative >= 0 ? '+' : '';
        const minusOrPlusMonthly = totalProfitMonthly >= 0 ? '+' : '';

        profit >= 0  
            ? bot.sendMessage(
                chatId,
                `✅ Short clôturé : PAYÉ ! 🤑🤑🤑🤑\n\n` +
                `- Symbole : BTC / USDC\n` +
                `- Gain réalisé 💶 : +${profit} USDC\n` +
                `- Pourcentage réalisé 📊 : +${profitPercentage} %\n\n` +
                `- Gains mensuels 💰 : ${minusOrPlusMonthly}${totalProfitMonthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
                `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${totalProfitCumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
                `- Capital disponible 💎 : ${usdcBalance.toFixed(2)} USDC\n\n` +
                `💪 ${getGainMessage()}`
            )
            : bot.sendMessage(
                chatId,
                `✅ Short clôturé : Pas payé. 💩\n\n` +
                `- Symbole : BTC / USDC\n` +
                `- Perte réalisée 💩 : -${Math.abs(profit)} USDC\n` +
                `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
                `- Gains mensuels 💰 : ${minusOrPlusMonthly}${totalProfitMonthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
                `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${totalProfitCumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
                `- Capital disponible 💎 : ${usdcBalance} USDC\n\n` +
                `🧘 ${getLossMessage()}`
            )
    } else {
        bot.sendMessage(
            chatId,
            `✅ Short clôturé : Pas de données disponibles. Merci de vérifier les transactions.`
        );
    }

    hasOpenShortPosition = false;
    lastSellPrice = null;
    shortQuantity = null;
}

module.exports = { handleCloseShort };
