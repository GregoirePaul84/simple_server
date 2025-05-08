const { getGainMessage, getLossMessage } = require('../botmessages');
const { getIsolatedMarginAccount } = require('../getIsolatedMarginAccount');

// Fonction pour gérer une vente
const handleCloseShort = async (
    symbol,
    initialPrice,
    executedPrice,
    executedQuantity,
    initialCapital,
    totalProfitCumulative,
    totalProfitMonthly,
    bot,
    chatId
) => {
    if (!initialPrice || !executedPrice || !executedQuantity) {
        console.error('Données manquantes pour calculer les profits ou pertes.');
        bot.sendMessage(
            chatId,
            `✅ Short clôturé : Données manquantes pour calculer les profits ou pertes.`
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

    const profitOrLoss = ((initialPrice - executedPrice) * executedQuantity).toFixed(2);
    const profitPercentage = (((initialPrice - executedPrice) / initialPrice) * 100).toFixed(2);

    console.log(`Profit ou Perte : ${profitOrLoss} USDC, ${profitPercentage}%`);

    totalProfitMonthly += parseFloat(profitOrLoss);
    totalProfitCumulative += parseFloat(profitOrLoss);

    const totalProfitMonthlyPercentage = ((totalProfitMonthly / initialCapital) * 100).toFixed(2);
    const totalProfitCumulativePercentage = ((totalProfitCumulative / initialCapital) * 100).toFixed(2);

    const minusOrPlusMonthly = totalProfitMonthly >= 0 ? '+' : '';
    const minusOrPlusCumulative = totalProfitCumulative >= 0 ? '+' : '';

    if (profitOrLoss >= 0) {
        bot.sendMessage(
            chatId,
            `✅ Short clôturé : PAYÉ ! 🤑🤑🤑🤑\n\n` +
            `- Symbole : ${symbol}\n` +
            `- Gain réalisé 💶 : +${profitOrLoss} USDC\n` +
            `- Pourcentage réalisé 📊 : +${profitPercentage} %\n\n` +
            `- Gains mensuels 💰 : ${minusOrPlusMonthly}${totalProfitMonthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
            `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${totalProfitCumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
            `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC, ${newAssetBalance} ${symbol === 'BTCUSDC' ? 'BTC' : 'DOGE'}\n\n` +
            `💪 ${getGainMessage()}`
        );
    } else {
        bot.sendMessage(
            chatId,
            `✅ Short clôturé : Pas payé. 💩\n\n` +
            `- Symbole : ${symbol}\n` +
            `- Perte réalisée 💩 : -${Math.abs(profitOrLoss)} USDC\n` +
            `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
            `- Gains mensuels 💰 : ${minusOrPlusMonthly}${totalProfitMonthly.toFixed(2)} USDC, ${minusOrPlusMonthly}${totalProfitMonthlyPercentage} %\n` +
            `- Gains totaux 💰💰 : ${minusOrPlusCumulative}${totalProfitCumulative.toFixed(2)} USDC, ${minusOrPlusCumulative}${totalProfitCumulativePercentage} %\n\n` +
            `- Capital disponible 💎 : ${newUsdcBalance.toFixed(2)} USDC, ${newAssetBalance} ${symbol === 'BTCUSDC' ? 'BTC' : 'DOGE'}\n\n` +
            `🧘 ${getLossMessage()}`
        );
    }

    initialPrice = null;
};

module.exports = { handleCloseShort };
