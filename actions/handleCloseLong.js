const { getGainMessage, getLossMessage } = require('../botmessages');

// Fonction pour gérer une vente
const handleCloseLong = async(
    binance, 
    symbol, 
    price, 
    btcBalance, 
    hasOpenLongPosition, 
    lastBuyPrice, 
    initialCapital, 
    totalProfitCumulative, 
    totalProfitMonthly, 
    bot, 
    chatId
) => {

    // Test local
    // hasOpenLongPosition = true;
    // btcBalance = 0.0010000;
    // lastBuyPrice = 110000;
    // totalProfitCumulative = 22.27;
    // totalProfitMonthly = 22.27;

    // Vérification qu'une position longue existe
    if (!hasOpenLongPosition) {
        console.error('Pas de position longue ouverte. Impossible de clôturer.');
        throw new Error('Pas de position longue ouverte. Impossible de clôturer.');
    }

    // Vérification du solde BTC pour une vente
    if (btcBalance <= 0) {
        console.error('Solde BTC insuffisant. Impossible de clôturer.');
        throw new Error('Solde BTC insuffisant. Impossible de clôturer.');
    }

    const quantityToSell = btcBalance.toFixed(6);

    // ATTENTION : la ligne suivante interagit avec Binance
    // const order = await binance.marketSell(symbol, quantityToSell);
    console.log('Clôture de la position longue.');

    // Récupération de la nouvelle balance
    const accountInfo = await binance.balance();
        
    const newUsdcBalance = parseFloat(accountInfo.USDC.available);
    const newBtcBalance = parseFloat(accountInfo.BTC.available);

    if (lastBuyPrice) {
        const profit = ((price - lastBuyPrice) * quantityToSell).toFixed(2);
        const profitPercentage = (((price - lastBuyPrice) / lastBuyPrice) * 100).toFixed(2);

        totalProfitCumulative += parseFloat(profit);
        totalProfitMonthly += parseFloat(profit);

        const totalProfitCumulativePercentage = ((totalProfitCumulative / initialCapital) * 100).toFixed(2); // Pourcentage cumulé depuis le début
        const totalProfitMonthlyPercentage = ((totalProfitMonthly / initialCapital) * 100).toFixed(2); // Pourcentage cumulé depuis le mois

        const minusOrPlusCumulative = totalProfitCumulative >= 0 ? '+' : '';
        const minusOrPlusMonthly = totalProfitMonthly >= 0 ? '+' : '';

        profit >= 0  
            ? bot.sendMessage(
                chatId,
                `✅ Long clôturé : PAYÉ ! 🤑🤑🤑🤑\n\n` +
                `- Symbole : BTC / USDC\n` +
                `- Gain réalisé 💶 : +${profit} USDC\n` +
                `- Pourcentage réalisé 📊 : +${profitPercentage} %\n\n` +
                `- Gains mensuels 💰 : ${minusOrPlusMonthly}${totalProfitMonthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
                `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${totalProfitCumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
                `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC, ${newBtcBalance} BTC\n\n` +
                `💪 ${getGainMessage()}`
            )
            : bot.sendMessage(
                chatId,
                `✅ Long clôturé : Pas payé. 💩\n\n` +
                `- Symbole : BTC / USDC\n` +
                `- Perte réalisée 💩 : -${Math.abs(profit)} USDC\n` +
                `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
                `- Gains mensuels 💰 : ${minusOrPlusMonthly}${totalProfitMonthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
                `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${totalProfitCumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
                `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC, ${newBtcBalance} BTC\n\n` +
                `🧘 ${getLossMessage()}`
        );
    } else {
        bot.sendMessage(
            chatId,
            `✅ Long clôturé : Pas de données disponibles. Merci de vérifier les transactions.`
        );
    }

    hasOpenLongPosition = false;
    lastBuyPrice = null;
    
}

module.exports = { handleCloseLong };