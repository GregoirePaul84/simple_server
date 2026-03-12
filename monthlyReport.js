const schedule = require('node-schedule');

// Fonction pour envoyer le rapport mensuel
const sendMonthlyReport = (
    bot, 
    chatId, 
    totalProfitCumulative, 
    initialCapital, 
    totalProfitMonthly 
) => {

    const monthlyProfitPercentage = ((totalProfitMonthly / initialCapital) * 100).toFixed(2);
    const totalProfitPercentage = ((totalProfitCumulative / initialCapital) * 100).toFixed(2);

    if (totalProfitMonthly >= 0) {
        // Rapport positif
        const positiveMessage = 
        `📅 Rapport mensuel : PAYÉ ! 🎉\n\n` +
        `- Gains totaux mensuels 💰 : ${totalProfitMonthly.toFixed(2)} USDT\n` +
        `- Pourcentage de gains mensuel 📊 : ${monthlyProfitPercentage} %\n\n` +
        `- Gains totaux cumulés 💰💰 : ${totalProfitCumulative.toFixed(2)} USDT\n` +
        `- Pourcentage total 📊📊 : ${totalProfitPercentage} %\n\n` +
        `🚀🚀🚀🚀 To the moon ! 🚀🚀🚀🚀`;
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAMQZ0CkvHDQI7qo2-cLGyAtzSrpxw4AAioAA8GcYAwjxoukwOqqDDYE')
        bot.sendMessage(chatId, positiveMessage);
    } else {
        // Rapport négatif
        const negativeMessage = 
        `📅 Rapport mensuel : Pas payé. 😔\n\n` +
        `- Pertes totales mensuelles 💰 : ${Math.abs(totalProfitMonthly).toFixed(2)} USDT\n` +
        `- Pourcentage de pertes mensuel 📊 : ${Math.abs(totalProfitPercentage)} %\n\n` +
        `- Gains totaux cumulés 💰💰 : ${totalProfitCumulative.toFixed(2)} USDT\n` +
        `- Pourcentage total 📊📊 : ${totalProfitPercentage} %\n\n` +
        `🧘‍♂️🧘‍♂️🧘‍♂️🧘‍♂️ Gardons confiance, la stratégie est bonne ! 🧘‍♂️🧘‍♂️🧘‍♂️🧘‍♂️`;
        bot.sendSticker(chatId, 'CAACAgIAAxkBAAMRZ0Ck60klGlUzTX4YoMtWjik8f-oAAi0AA8GcYAzjNPIncv-QZTYE'); 
        bot.sendMessage(chatId, negativeMessage);
    }
};


const scheduleMonthlyReport = (bot, chatId, getTotalProfitCumulative, getTotalProfitMonthly, resetMonthlyProfit, initialCapital) => {
    schedule.scheduleJob('59 23 28-31 * *', () => {
        const today = new Date();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        if (today.getDate() === lastDayOfMonth) {
            sendMonthlyReport(bot, chatId, getTotalProfitCumulative(), initialCapital, getTotalProfitMonthly());
            resetMonthlyProfit();
        }
    });
};

module.exports = { scheduleMonthlyReport, sendMonthlyReport };
