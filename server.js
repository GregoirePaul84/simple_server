require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Binance = require('binance-api-node').default;
const { ErrorCodes } = require('binance-api-node');
const TelegramBot = require('node-telegram-bot-api');
const { getIsolatedMarginAccount } = require('./getIsolatedMarginAccount');
const { getBalanceData } = require('./getBalanceData');
const { takeLongPosition } = require('./actions/takeLongPosition');
const { takeShortPosition } = require('./actions/takeShortPosition');
const { placeOCOOrder } = require('./actions/placeOcoOrder');
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
const binance = Binance({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    // family: 4, // Forcer l'utilisation d'IPv4
    // useServerTime: true, // Synchronisation avec l'heure du serveur Binance
    // reconnect: true, // Permet de se reconnecter automatiquement
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
const initialCapital = 102.69752060; // Capital initial en USDC

// Setter pour réinitialiser les profits mensuels
const resetMonthlyProfit = () => {
    totalProfitMonthly = 0;
    console.log('Profit mensuel réinitialisé.');
};

// Route pour tester la connexion
app.get('/', (_, res) => {
    res.send('Le serveur fonctionne correctement !');
});

app.use((req, res, next) => {
    console.log(`Requête reçue de : ${req.ip}`);
    next();
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

app.get('/balance', async (_, res) => {
    try {
        // Appel à l'API pour récupérer le portefeuille de marge isolée
        const data = await getIsolatedMarginAccount(
            process.env.BINANCE_API_KEY,
            process.env.BINANCE_API_SECRET
        );

        // Recherche de la paire BTCUSDT
        const btcUsdcData = data.assets.find(asset => asset.symbol === 'BTCUSDC');

        if (!btcUsdcData) {
            throw new Error('La paire BTCUSDC n\'a pas été trouvée dans le portefeuille isolé.');
        }

        // Extraire les balances pour BTC (baseAsset) et USDC (quoteAsset)
        const usdcBalance = btcUsdcData.quoteAsset.free;
        const btcBalance = btcUsdcData.baseAsset.free;

        res.status(200).json({
            message: 'Solde de marge isolée récupéré avec succès',
            usdcBalance,
            btcBalance,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la balance isolée :', error.message);
        res.status(500).json({ error: 'Impossible de récupérer la balance isolée' });
    }
});


// Endpoint Webhook pour recevoir les alertes de TradingView
app.post('/webhook', async (req, res) => {
    const { action, symbol, key } = req.body;
    
    // Vérification de la clé secrète
    if (key !== process.env.WEBHOOK_SECRET) {
        console.log('clé secrète incorrecte');
        return res.status(401).send('Clé secrète incorrecte.');
    }

    try {
        console.log('début du webhook');
        
        // // Récupération du solde pour le portefeuille de marge isolée
        // const marginAccount = await getIsolatedMarginAccount(
        //     process.env.BINANCE_API_KEY,
        //     process.env.BINANCE_API_SECRET
        // );

        // // Balances pour BTC et USDC
        // const btcUsdcData = marginAccount.assets.find(asset => asset.symbol === 'BTCUSDC');

        // if (!btcUsdcData) {
        //     throw new Error('La paire BTCUSDC n\'a pas été trouvée dans le portefeuille isolé.');
        // }

        // const usdcBalance = parseFloat(btcUsdcData.quoteAsset.free);
        
        // Prix actuel BTC / USDC
        const prices = await binance.prices();
        const price = parseFloat(prices[symbol]);

        console.log(`Prix actuel du BTC => ${price}USDC`);
        
        // ****** GESTION POSITION LONGUE  ****** //
        // ACHAT LONG
        if (action === 'LONG') {           
            
            // Récupération de la balance USDC avant l'achat
            let btcUsdcData = await getBalanceData();
            const usdcBalance = parseFloat(btcUsdcData.quoteAsset.free);
            console.log('balance USDC avant position longue =>', usdcBalance);
            
            await takeLongPosition(binance, symbol, price, usdcBalance, hasOpenLongPosition, lastBuyPrice, bot, chatId);

            // Récupération de la balance BTC après l'achat
            btcUsdcData = await getBalanceData();
            const btcBalance = parseFloat(btcUsdcData.baseAsset.free);
            
            console.log('Solde réel BTC après achat :', btcBalance);

            // Ordre OCO : gestion des SL et TP en limit
            await placeOCOOrder(binance, symbol, 'BUY', price, btcBalance, bot, chatId);
        } 
        
        // ****** GESTION POSITION COURTE  ****** //
        // VENTE SHORT
        else if (action === 'SHORT') {

            // Récupération de la balance USDC avant la vente
            let btcUsdcData = await getBalanceData();
            const usdcBalance = parseFloat(btcUsdcData.quoteAsset.free);
            console.log('balance USDC avant position courte =>', usdcBalance);

            const shortOrder = await takeShortPosition(binance, symbol, price, usdcBalance, hasOpenShortPosition, lastSellPrice, shortQuantity, bot, chatId);

            // Ordre OCO : gestion des SL et TP en limit
            await placeOCOOrder(binance, symbol, 'SELL', price, parseFloat(shortOrder.executedQty), bot, chatId);
        } 

        res.status(200).send('Ordre effectué avec succès.')

    } catch (error) {
        console.log('le code erreur =>', error.code);
        
        if (error.code === ErrorCodes.INSUFFICIENT_BALANCE) {
            console.error('Erreur : Solde insuffisant pour effectuer l\'ordre.');
        } else if (error.code === ErrorCodes.INVALID_ORDER_TYPE) {
            console.error('Erreur : Type d\'ordre invalide.');
        } else if (error.code === -2010) { // "New order rejected"
            console.error('Erreur : Nouvel ordre rejeté. Vérifiez les règles de la paire.');
        } else {
            console.error('Erreur générale :', error.message);
        }
        
        bot.sendMessage(chatId, `❌ Erreur : ${error.message}`);
        res.status(500).send('Erreur lors de l\'exécution de l\'ordre.');
    }
});


// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur ${externalURL}`);
});

// Planification du rapport mensuel
scheduleMonthlyReport(bot, chatId, () => totalProfitCumulative, () => totalProfitMonthly, resetMonthlyProfit);
