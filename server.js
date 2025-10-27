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
const { handleCloseLong } = require('./actions/handleCloseLong');
const { handleCloseShort } = require('./actions/handleCloseShort');
const WebSocket = require('ws');
const { getIsolatedMarginListenKey, keepAliveMarginListenKey } = require('./websocket');

// Configuration de Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

const externalURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

// Instance Express
const app = express();
const port = 3000;

// Middleware pour traiter les JSON reçus par tradingview
app.use(bodyParser.json());

// Configuration de Binance API pour le swing trading
const binanceMargin = Binance({
    apiKey: process.env.BINANCE_MARGIN_API_KEY,
    apiSecret: process.env.BINANCE_MARGIN_API_SECRET,
    reconnect: true, // Permet de se reconnecter automatiquement
    verbose: true, // Affiche les logs pour aider au débogage
    getTime: () => Date.now()
});

// Variables de base

let totalProfitMonthly = 0; // Total du mois en cours
let totalProfitCumulative = 0; // Total depuis le début
const initialCapital = 2000; // Capital initial en USDC
const initialPrices = {
    BTCUSDC: null,
    DOGEUSDC: null
};

// Connecter le WebSocket utilisateur pour détecter le passage des ordres OCO
const createWebSocketForSymbol = async (symbol) => {
    const listenKey = await getIsolatedMarginListenKey(symbol);
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${listenKey}`);

    ws.on('open', () => {
        console.log(`WebSocket connecté pour ${symbol}.`);
    });

    ws.on('message', async(data) => {
        const message = JSON.parse(data);
        console.log(`Message WebSocket reçu pour ${symbol}:`, message);

        if (message.e === 'executionReport' && message.X === 'FILLED') {
            if (message.o === 'STOP_LOSS_LIMIT' || message.o === 'LIMIT_MAKER') {
                console.log(`Ordre OCO exécuté pour ${message.s}`);

                const executedPrice = parseFloat(message.p);
                const executedQuantity = parseFloat(message.q);

                try {
                    
                    if (message.S === 'SELL') {
                        await handleCloseLong(symbol, initialPrices[symbol], executedPrice, executedQuantity, initialCapital, totalProfitMonthly, totalProfitCumulative, bot, chatId);
                    } else if (message.S === 'BUY') {
                        await handleCloseShort(symbol, initialPrices[symbol], executedPrice, executedQuantity, initialCapital, totalProfitMonthly, totalProfitCumulative, bot, chatId);

                        await binanceMargin.marginRepay({
                            asset: symbol.replace('USDC', ''),
                            amount: executedQuantity,
                            isIsolated: true,
                            symbol,
                        });

                        console.log(`✅ Remboursement effectué pour ${symbol}`);
                    }

                } catch (error) {
                    console.error(`❌ Erreur lors de la clôture ou du remboursement :`, error.message);
                }              
            }
        }
    });

    ws.on('error', (err) => {
        console.error(`Erreur WebSocket pour ${symbol}:`, err);
    });

    ws.on('close', () => {
        console.log(`WebSocket pour ${symbol} fermé. Reconnexion dans 5s...`);
        setTimeout(() => createWebSocketForSymbol(symbol), 5000);
    });

    // Keep alive
    setInterval(() => keepAliveMarginListenKey(listenKey, symbol), 50 * 60 * 1000);
};

const startUserWebSocket = async () => {
    const symbols = ['BTCUSDC', 'DOGEUSDC'];
    for (const symbol of symbols) {
        await createWebSocketForSymbol(symbol);
    }
};

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
            process.env.BINANCE_MARGIN_API_KEY,
            process.env.BINANCE_MARGIN_API_SECRET
        );

        // Recherche de la paire BTCUSDC
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
    const { action, type, symbol, key } = req.body;
    
    // Vérification de la clé secrète
    if (key !== process.env.WEBHOOK_SECRET) {
        console.log('clé secrète incorrecte');
        return res.status(401).send('Clé secrète incorrecte.');
    }

    try {
        console.log('début du webhook');
        
        // Prix actuel BTC / USDC ou DOGE / USDC
        const prices = await binanceMargin.prices();
        const price = parseFloat(prices[symbol]);

        console.log(`Prix actuel de l'actif pour ${symbol} => ${price} USDC`);
        
        // ****** GESTION POSITION LONGUE  ****** //

        // ACHAT LONG
        if (action === 'LONG') {           
            
            // Récupération de la balance USDC avant l'achat
            let balanceData = await getBalanceData(symbol);
            const usdcBalance = parseFloat(balanceData.quoteAsset.free);
            console.log(`balance USDC avant position longue pour ${symbol} =>`, usdcBalance);

            const longOrder = await takeLongPosition(binanceMargin, symbol, type, price, usdcBalance, bot, chatId);

            initialPrices[symbol] = longOrder.initialPrice;

            console.log(`Actifs achetés sur ${initialPrices[symbol]} pour ${symbol}`);

            const assetsBought = parseFloat(longOrder.order.executedQty); // Quantité exacte achetée
            console.log('Actifs achetés dans cet ordre :', assetsBought);

            const feeRate = 0.001;
            const assetsAvailable = assetsBought * (1 - feeRate); // Enlève les frais
            console.log(`Actifs réellement disponibles après frais: ${assetsAvailable}`);

            // Ordre OCO : gestion des SL et TP en limit
            await placeOCOOrder(binanceMargin, symbol, type, 'BUY', price, assetsAvailable, bot, chatId);
        } 
        
        // ****** GESTION POSITION COURTE  ****** //
        // VENTE SHORT
        else if (action === 'SHORT') {
            
            // Récupération de la balance USDC avant la vente
            let balanceData = await getBalanceData(symbol);
            const usdcBalance = parseFloat(balanceData.quoteAsset.free);
            
            console.log('balance USDC avant position courte =>', usdcBalance);

            const shortOrder = await takeShortPosition(binanceMargin, symbol, type, price, usdcBalance, bot, chatId);

            initialPrices[symbol] = shortOrder.initialPrice;

            console.log(`Actifs shortés sur ${initialPrices[symbol]} pour ${symbol}`);

            const assetsSold = parseFloat(shortOrder.order.executedQty); // Quantité exacte vendue
            console.log('Nombre shorté dans cet ordre :', assetsSold);

            const feeRate = 0.001;
            const assetsAvailable = assetsSold * (1 - feeRate); // Enlève les frais
            console.log(`Actifs réellement disponible après frais: ${assetsAvailable}`);
            
            // Ordre OCO : gestion des SL et TP en limit
            await placeOCOOrder(binanceMargin, symbol, type, 'SELL', price, assetsAvailable, bot, chatId);
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
        res.status(500).json({ message: 'Erreur lors de l\'exécution de l\'ordre.', error: error.message });
        return { order: null, initialPrice: null };
    }
});

// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur ${externalURL}`);
});


const init = () => {
    startUserWebSocket(); // Données de Binance
    scheduleMonthlyReport(bot, chatId, () => totalProfitCumulative, () => totalProfitMonthly, resetMonthlyProfit); // Rapport Telegram mensuel
}

init();


