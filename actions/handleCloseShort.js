const { getGainMessage, getLossMessage } = require('../botmessages');
const { default: takeLongPosition } = require('./takeLongPosition');

// Fonction pour gérer une vente
const handleCloseShort = async(binance, symbol, price, usdcBalance, hasOpenShortPosition, lastSellPrice, shortQuantity) => {

    // Vérification qu'une position courte existe
    if (!shortQuantity || shortQuantity <= 0) {
        console.error('Pas de position courte ouverte. Achat non autorisé.');
        bot.sendMessage(
            chatId,
            'Erreur: tentative de clôture de short => pas de position courte existante \n', error
        )
        return;
    }

    // Vérification du solde USDC pour racheter la position
    const requiredUSDC = price * shortQuantity;
    if (usdcBalance < requiredUSDC) {
        console.error('Solde insuffisant en USDC pour racheter la position.');
        bot.sendMessage(
            chatId,
            'Erreur: tentative de clôture de short => solde insuffisant en USDC pour racheter la position. \n', error
        )
        return;
    }

    // ATTENTION : la ligne suivante interagit avec Binance
    // const order = await binance.marketBuy(symbol, shortQuantity);
    // console.log('Clôture du short :', order);

    if (lastSellPrice) {
        const profit = ((lastSellPrice - price) * quantityToBuy).toFixed(2); // Profit ou perte de la transaction en USDC
        const profitPercentage = (((lastSellPrice - price) / lastSellPrice) * 100).toFixed(2); // Pourcentage de la transaction

        totalProfitCumulative += parseFloat(profit); // Profit cumulé depuis le début
        totalProfitMonthly += parseFloat(profit); // Profit cumulé depuis le mois

        const totalProfitCumulativePercentage = ((totalProfitCumulative / initialCapital) * 100).toFixed(2); // Pourcentage cumulé depuis le début
        const totalProfitMonthlyPercentage = ((totalProfitMonthly / initialCapital) * 100).toFixed(2); // Pourcentage cumulé depuis le mois

        bot.sendMessage(
            chatId,
            profit >= 0  
                ? bot.sendMessage(
                    chatId,
                    `✅ Short clôturé : PAYÉ ! 🤑🤑🤑🤑\n\n` +
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
                    `✅ Short clôturé : Pas payé. 💩\n\n` +
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
            `✅ Short clôturé : Pas de données disponibles. Merci de vérifier les transactions.`
        );
    }

    hasOpenShortPosition = false;
    lastSellPrice = null;
    shortQuantity = null;
}

module.exports = { handleCloseShort };
