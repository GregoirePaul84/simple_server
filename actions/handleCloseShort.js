const { getGainMessage, getLossMessage } = require('../botmessages');
const { getBalanceData } = require('../getBalanceData');

const handleCloseShort = async (
    symbol,
    initialPrice,
    executedPrice,
    executedQuantity,
    initialCapital,
    profits,
    bot,
    chatId
) => {
    console.log('DEBUG handleCloseShort inputs', { symbol, initialPrice, executedPrice, executedQuantity });

    if (!initialPrice || !executedPrice || !executedQuantity) {
        console.error('Données manquantes pour calculer les profits ou pertes.');
        bot.sendMessage(chatId, `✅ Short clôturé : Données manquantes pour calculer les profits ou pertes.`);
        return;
    }

    const balanceData = await getBalanceData(symbol);
    const newUsdcBalance = parseFloat(balanceData.quoteAsset.free);

    const profitOrLoss = ((initialPrice - executedPrice) * executedQuantity).toFixed(2);
    const profitPercentage = (((initialPrice - executedPrice) / initialPrice) * 100).toFixed(2);

    console.log(`Profit ou Perte : ${profitOrLoss} USDC, ${profitPercentage}%`);

    profits.monthly    += parseFloat(profitOrLoss);
    profits.cumulative += parseFloat(profitOrLoss);

    const totalProfitMonthlyPercentage    = ((profits.monthly    / initialCapital) * 100).toFixed(2);
    const totalProfitCumulativePercentage = ((profits.cumulative / initialCapital) * 100).toFixed(2);

    const minusOrPlusMonthly    = profits.monthly    >= 0 ? '+' : '';
    const minusOrPlusCumulative = profits.cumulative >= 0 ? '+' : '';

    if (parseFloat(profitOrLoss) >= 0) {
        bot.sendMessage(
            chatId,
            `✅ Short clôturé : PAYÉ ! 🤑🤑🤑🤑\n\n` +
            `- Symbole : ${symbol}\n` +
            `- Gain réalisé 💶 : +${profitOrLoss} USDC\n` +
            `- Pourcentage réalisé 📊 : +${profitPercentage} %\n\n` +
            `- Gains mensuels 💰 : ${minusOrPlusMonthly}${profits.monthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
            `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${profits.cumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
            `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC\n\n` +
            `💪 ${getGainMessage()}`
        );
    } else {
        bot.sendMessage(
            chatId,
            `✅ Short clôturé : Pas payé. 💩\n\n` +
            `- Symbole : ${symbol}\n` +
            `- Perte réalisée 💩 : -${Math.abs(profitOrLoss)} USDC\n` +
            `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
            `- Gains mensuels 💰 : ${minusOrPlusMonthly}${profits.monthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
            `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${profits.cumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
            `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC\n\n` +
            `🧘 ${getLossMessage()}`
        );
    }
};

module.exports = { handleCloseShort };
