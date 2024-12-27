const { getGainMessage, getLossMessage } = require('../botmessages');
const { getIsolatedMarginAccount } = require('../getIsolatedMarginAccount');

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
    console.log('position longue ouverte ?', hasOpenLongPosition);
    
    // Vérification qu'une position longue existe
    // if (!hasOpenLongPosition) {
    //     console.error('Pas de position longue ouverte. Impossible de clôturer.');
    //     throw new Error('Pas de position longue ouverte. Impossible de clôturer.');
    // }

    // Vérification du solde BTC pour une vente
    if (btcBalance <= 0) {
        console.error('Solde BTC insuffisant. Impossible de clôturer.');
        throw new Error('Solde BTC insuffisant. Impossible de clôturer.');
    }

    const stepSize = 0.00001; // LOT_SIZE pour BTCUSDC
    const quantityToSell = Math.floor(btcBalance / stepSize) * stepSize;

    console.log('Quantité ajustée pour vente :', quantityToSell);

    // Étape 1 : Vendre les BTC pour fermer la position longue
    const order = await binance.marginOrder({
        symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: quantityToSell,
        isIsolated: true, // Spécifie que c'est une opération de marge isolée
    });

    console.log('Clôture de la position longue.', order);

    // Étape 2 : Récupération de la balance après la vente
    const marginAccount = await getIsolatedMarginAccount(
        process.env.BINANCE_API_KEY,
        process.env.BINANCE_API_SECRET
    );

    const btcUsdcData = marginAccount.assets.find(asset => asset.symbol === 'BTCUSDC');

    if (!btcUsdcData) {
        throw new Error('Impossible de récupérer les données pour la paire BTCUSDC.');
    }

    const newUsdcBalance = parseFloat(btcUsdcData.quoteAsset.free);
    const newBtcBalance = parseFloat(btcUsdcData.baseAsset.free);

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