const { getGainMessage, getLossMessage } = require('../botmessages');

// Fonction pour gérer une vente
const handleCloseLong = async(binance, symbol, price, btcBalance, hasOpenLongPosition, lastBuyPrice) => {

    // Vérification qu'une position longue existe
    if (!hasOpenLongPosition) {
        console.error('Pas de position longue ouverte. Vente non autorisée.');
        return res.status(400).send('Pas de position longue ouverte.');
    }

    // Vérification du solde BTC pour une vente
    if (btcBalance <= 0) {
        console.error('Solde insuffisant en BTC pour vendre.');
        return res.status(400).send('Solde BTC insuffisant.');
    }

    const quantityToSell = btcBalance.toFixed(6);

    // ATTENTION : la ligne suivante interagit avec Binance
    // const order = await binance.marketSell(symbol, quantityToSell);
    // console.log('Clôture de la position longue :', order);

    if (lastBuyPrice) {
        const profit = ((price - lastBuyPrice) * quantityToSell).toFixed(2);
        const profitPercentage = (((price - lastBuyPrice) / lastBuyPrice) * 100).toFixed(2);

        totalProfitCumulative += parseFloat(profit);
        totalProfitMonthly += parseFloat(profit);

        bot.sendMessage(
            chatId,
            profit >= 0  
                ? bot.sendMessage(
                    chatId,
                    `✅ Long clôturé : : PAYÉ ! 🤑🤑🤑🤑\n\n` +
                    `- Symbole : BTC / USDC\n` +
                    `- Gain réalisé 💶 : ${profit} USDC\n` +
                    `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
                    `- Gains mensuels 💰 : ${totalProfitMonthly.toFixed(2)} USDC, ${totalProfitMonthlyPercentage} %\n` +
                    `- Gains totaux 💰💰 : ${totalProfitCumulative.toFixed(2)} USDC, ${totalProfitCumulativePercentage} %\n\n` +
                    `- Capital disponible 💎 : ${USDCBalance} USDC\n\n` +
                    `💪 ${getGainMessage()}`
                )
                : bot.sendMessage(
                    chatId,
                    `✅ Long clôturé : : Pas payé. 💩\n\n` +
                    `- Symbole : BTC / USDC\n` +
                    `- Perte réalisée 💩 : -${Math.abs(profit)} USDC\n` +
                    `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
                    `- Gains mensuels 💰 : ${totalProfitMonthly.toFixed(2)} USDC, ${totalProfitMonthlyPercentage} %\n` +
                    `- Gains totaux 💰💰 : ${totalProfitCumulative.toFixed(2)} USDC, ${totalProfitCumulativePercentage} %\n\n` +
                    `- Capital disponible 💎 : ${USDCBalance} USDC\n\n` +
                    `🧘 ${getLossMessage()}`
                )
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