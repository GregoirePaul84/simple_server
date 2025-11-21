const { getGainMessage, getLossMessage } = require('../botmessages');
const { getIsolatedMarginAccount } = require('../getIsolatedMarginAccount');
// const { clearLongDust } = require('./clearLongDust');

const handleCloseLong = async (
    symbol,
    initialPrice,
    executedPrice,
    executedQuantity,
    initialCapital,
    profits,
    bot,
    chatId,
    // binanceMargin
) => {

    console.log('DEBUG handleCloseLong inputs', {
        symbol,
        initialPrice,
        executedPrice,
        executedQuantity,
    });

    if (!initialPrice || !executedPrice || !executedQuantity) {
        console.error('Données manquantes pour calculer les profits ou pertes.');
        bot.sendMessage(
            chatId,
            `✅ Long clôturé : Données manquantes pour calculer les profits ou pertes.`
        );
        return;
    }

    // Récupération des balances actuelles après clôture potentielle (via OCO)
    const marginAccount = await getIsolatedMarginAccount(
        process.env.BINANCE_MARGIN_API_KEY,
        process.env.BINANCE_MARGIN_API_SECRET
    );

    const assetsData = marginAccount.assets.find(asset => asset.symbol === `${symbol}`);

    if (!assetsData) {
        throw new Error(`Impossible de récupérer les données pour la paire ${symbol}.`);
    }

    const newUsdcBalance = parseFloat(assetsData.quoteAsset.free);
    const newAssetBalance = parseFloat(assetsData.baseAsset.free);

    const profitOrLoss = ((executedPrice - initialPrice) * executedQuantity).toFixed(2);
    const profitPercentage = (((executedPrice - initialPrice) / initialPrice) * 100).toFixed(2);

    console.log(`Profit ou Perte : ${profitOrLoss} USDC, ${profitPercentage}%`);

    profits.monthly += parseFloat(profitOrLoss);
    profits.cumulative += parseFloat(profitOrLoss);

    const totalProfitMonthlyPercentage = ((profits.monthly / initialCapital) * 100).toFixed(2);
    const totalProfitCumulativePercentage = ((profits.cumulative / initialCapital) * 100).toFixed(2);

    const minusOrPlusMonthly = profits.monthly >= 0 ? '+' : '';
    const minusOrPlusCumulative = profits.cumulative >= 0 ? '+' : '';

    if (profitOrLoss >= 0) {
        bot.sendMessage(
            chatId,
            `✅ Long clôturé : PAYÉ ! 🤑🤑🤑🤑\n\n` +
            `- Symbole : ${symbol}\n` +
            `- Gain réalisé 💶 : +${profitOrLoss} USDC\n` +
            `- Pourcentage réalisé 📊 : +${profitPercentage} %\n\n` +
            `- Gains mensuels 💰 : ${minusOrPlusMonthly}${profits.monthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
            `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${profits.cumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
            `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC, ${newAssetBalance} ${symbol === 'BTCUSDC' ? 'BTC' : 'DOGE'}\n\n` +
            `💪 ${getGainMessage()}`
        );
    } else {
        bot.sendMessage(
            chatId,
            `✅ Long clôturé : Pas payé. 💩\n\n` +
            `- Symbole : ${symbol}\n` +
            `- Perte réalisée 💩 : -${Math.abs(profitOrLoss)} USDC\n` +
            `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
            `- Gains mensuels 💰 : ${minusOrPlusMonthly}${profits.monthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
            `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${profits.cumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
            `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC, ${newAssetBalance} ${symbol === 'BTCUSDC' ? 'BTC' : 'DOGE'}\n\n` +
            `🧘 ${getLossMessage()}`
        );
    }

    initialPrice = null;
};


module.exports = { handleCloseLong };