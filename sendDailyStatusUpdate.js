const { getIsolatedMarginAccount } = require('./getIsolatedMarginAccount');

const sendDailyStatusUpdate = async (bot, chatId) => {
    try {
        // Récupération des données du portefeuille isolé
        const marginAccount = await getIsolatedMarginAccount(
            process.env.BINANCE_API_KEY,
            process.env.BINANCE_API_SECRET
        );

        const btcUsdcData = marginAccount.assets.find(asset => asset.symbol === 'BTCUSDC');

        if (!btcUsdcData) {
            throw new Error('Impossible de récupérer les données pour la paire BTCUSDC.');
        }

        const usdcBalance = parseFloat(btcUsdcData.quoteAsset.free).toFixed(2);
        const btcBalance = parseFloat(btcUsdcData.baseAsset.free).toFixed(5);

        // Envoyer la notification au bot Telegram
        bot.sendMessage(
            chatId,
            `✅ Rapport quotidien du serveur :\n\n` +
            `- Solde disponible 💎 :\n` +
            `  - USDC : ${usdcBalance} 💵\n` +
            `  - BTC : ${btcBalance} ₿\n\n` +
            `📡 Le serveur fonctionne correctement !`
        );

        console.log('Notification quotidienne envoyée avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la notification quotidienne :', error.message);
        bot.sendMessage(
            chatId,
            `❌ Erreur lors de l'envoi du rapport quotidien : ${error.message}`
        );
    }
};

module.exports = { sendDailyStatusUpdate };