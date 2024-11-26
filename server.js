require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Binance = require('node-binance-api');
const TelegramBot = require('node-telegram-bot-api');
const { takeLongPosition } = require('./actions/takeLongPosition');
const { takeShortPosition } = require('./actions/takeShortPosition');
const { handleCloseLong } = require('./actions/handleCloseLong');
const { handleCloseShort } = require('./actions/handleCloseShort');
const { scheduleMonthlyReport, sendMonthlyReport } = require('./monthlyReport'); // Import du fichier pour le rapport mensuel

// Configuration de Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

const externalURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

// Instance Express
const app = express();
const port = 3000;

// Middleware pour traiter les JSON reçus par tradingview
app.use(bodyParser.json());

// Configuration de Binance API
const binance = new Binance().options({
    APIKEY: process.env.BINANCE_API_KEY, // Clé API Binance
    APISECRET: process.env.BINANCE_API_SECRET, // Clé secrète Binance
    family: 4, // Forcer l'utilisation d'IPv4
    useServerTime: true, // Synchronisation avec l'heure du serveur Binance
    reconnect: true, // Permet de se reconnecter automatiquement
    verbose: true, // Affiche les logs pour aider au débogage
});

// Variables de base
let hasOpenLongPosition = false; // Position longue en cours ou non
let hasOpenShortPosition = false; // Position short en cours ou non
let lastBuyPrice = null; // Dernier prix d'achat
let lastSellPrice = null; // Dernier prix de short
let shortQuantity = null; // Nombre de BTC vendus à découvert pour le short
let totalProfitCumulative = 0; // Total depuis le début
let totalProfitMonthly = 0; // Total du mois en cours
const initialCapital = 100; // Capital initial en USDC

// Setter pour réinitialiser les profits mensuels
const resetMonthlyProfit = () => {
    totalProfitMonthly = 0;
    console.log('Profit mensuel réinitialisé.');
};

// Route pour tester la connexion
app.get('/', (_, res) => {
    res.send('Le serveur fonctionne correctement !');
});

// Test du message d'achat du bot
app.get('/buy-test', (_, res) => {
    const symbol = 'BTC / USDC';
    const quantity = 0.00015;
    const price = 1000;
    const stopLoss = price * 0.96;
    const takeProfit = price * 1.08
    const potentialGain = takeProfit - price;
    const potentialLoss = stopLoss - price;

    bot.sendMessage(
        chatId,
        `✅ Ordre d'achat exécuté :
        - Symbole : ${symbol}
        - Quantité : ${quantity}
        - Prix : ${price} USDC 
        - Gain potentiel : ${potentialGain} USDC
        - Perte potentielle : ${potentialLoss} USDC
        `
    );
    res.status(200).send('Rapport mensuel envoyé (test).');
});

// Test du compte rendu mensuel
app.get('/test-monthly-report', (_, res) => {
    // Appel direct à la fonction pour générer un rapport
    sendMonthlyReport(bot, chatId, totalProfitCumulative, initialCapital, totalProfitMonthly);
    res.status(200).send('Rapport mensuel envoyé (test).');
});

// Endpoint pour récupérer le solde
app.get('/balance', async (_, res) => {
    try {
        const accountInfo = await binance.balance(); // Récupère le solde complet

        const btcBalance = accountInfo.BTC.available; // Solde BTC disponible
        const USDCBalance = accountInfo.USDC.available; // Solde USDC disponible
        
        res.status(200).json({
            message: 'Solde récupéré avec succès',
            btcBalance,
            USDCBalance,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du solde :', error);
        res.status(500).json({ error: 'Impossible de récupérer le solde' });
    }
});

// Endpoint Webhook pour recevoir les alertes de TradingView
app.post('/webhook', async (req, res) => {
    const { action, symbol, key } = req.body;

    // Vérification de la clé secrète
    if (key !== process.env.WEBHOOK_SECRET) {
        return res.status(401).send('Clé secrète incorrecte.');
    }

    try {
        // Récupération du solde total disponible pour le trading
        const accountInfo = await binance.balance();
        const usdcBalance = parseFloat(accountInfo.USDC.available);
        const btcBalance = parseFloat(accountInfo.BTC.available);

        // Prix actuel BTC / USDC
        const prices = await binance.prices();
        const price = parseFloat(prices[symbol]);

        // ****** GESTION POSITION LONGUE  ****** //
        // ACHAT LONG
        if (action === 'LONG') {
            takeLongPosition(binance, symbol, price, usdcBalance, hasOpenLongPosition, lastBuyPrice);
        } 

        // VENTE LONG : stop loss et take profit
        else if (action === 'STOP_LOSS_LONG' || action === 'TAKE_PROFIT_LONG') {
            handleCloseLong(binance, symbol, price, btcBalance, hasOpenLongPosition, lastBuyPrice);
        }
        
        // ****** GESTION POSITION COURTE  ****** //
        // VENTE SHORT
        else if (action === 'SHORT') {
            takeShortPosition(binance, symbol, price, usdcBalance, hasOpenShortPosition, lastSellPrice, shortQuantity);
        } 

        // ACHAT SHORT : stop loss et take profit
        else if (action === 'STOP_LOSS_SHORT' || action === 'TAKE_PROFIT_SHORT') {
            handleCloseShort(binance, symbol, price, usdcBalance, hasOpenShortPosition, lastSellPrice, shortQuantity);
        }
    } catch (error) {
        console.error('Erreur lors de l\'exécution de l\'ordre :', error);

        // Notification d'erreur à Telegram
        bot.sendMessage(chatId, `❌ Erreur lors de l'exécution de l'ordre : ${error.message}`);
        
        res.status(500).send('Erreur lors de l\'exécution de l\'ordre.');
    }
});


// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur ${externalURL}`);
});

// Planification du rapport mensuel
scheduleMonthlyReport(bot, chatId, () => totalProfitCumulative, () => totalProfitMonthly, resetMonthlyProfit);
