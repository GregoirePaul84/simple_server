require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Binance = require('node-binance-api');
const TelegramBot = require('node-telegram-bot-api');

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

// Variable pour stocker le prix d'achat et calculer le gain / perte
let lastBuyPrice = null; // Dernier prix d'achat
let totalProfit = 0; // Gains totaux accumulés
const initialCapital = 100; // Capital initial en USDT

// Route pour tester la connexion
app.get('/', (req, res) => {
    res.send('Le serveur fonctionne correctement !');
});

// Endpoint pour récupérer le solde
app.get('/balance', async (_, res) => {
    try {
        const accountInfo = await binance.balance(); // Récupère le solde complet

        const btcBalance = accountInfo.BTC.available; // Solde BTC disponible
        const usdtBalance = accountInfo.USDT.available; // Solde USDT disponible
        
        res.status(200).json({
            message: 'Solde récupéré avec succès',
            btcBalance,
            usdtBalance,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du solde :');
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
        const usdtBalance = parseFloat(accountInfo.USDT.available);
        const btcBalance = parseFloat(accountInfo.BTC.available);

        // Vérification des positions ouvertes
        const openOrders = await binance.openOrders(symbol);
        if (openOrders.length > 0) {
            console.error(`Une position est déjà ouverte pour ${symbol}.`);
            return res.status(400).send('Position déjà ouverte.');
        }

        // Prix actuel BTC / USDT
        const prices = await binance.prices();
        const price = parseFloat(prices[symbol]);

        // Calcul de la quantité basée sur le solde
        const quantityToBuy = (usdtBalance / price).toFixed(6);
        const quantityToSell = btcBalance.toFixed(6);

        if (action === 'buy') {
            // Vérification du solde USDT pour un achat
            if (usdtBalance <= 0) {
                console.error('Solde insuffisant en USDT pour acheter.');
                return res.status(400).send('Solde USDT insuffisant.');
            }

            // Exécution de l'ordre d'achat
            const order = await binance.marketBuy(symbol, quantityToBuy);
            console.log('Ordre d\'achat effectué :', order);

            lastBuyPrice = price; // Enregistrement du prix d'achat

            // Envoi de notification Telegram
            bot.sendMessage(
                chatId,
                `✅ Ordre d'achat exécuté :\n- Symbole : ${symbol}\n- Quantité : ${quantity}\n- Prix : ${price} USDT`
            );

            res.status(200).send('Ordre d\'achat exécuté avec succès !');
        } else if (action === 'sell') {
            // TEST BOT
            lastBuyPrice = 93000;

            if (lastBuyPrice) {
                const profit = ((price - lastBuyPrice) * 0.001696).toFixed(2);
                const profitPercentage = (((price - lastBuyPrice) / lastBuyPrice) * 100).toFixed(2);

                // Mise à jour des gains totaux
                totalProfit += parseFloat(profit);
                const totalProfitPercentage = ((totalProfit / initialCapital) * 100).toFixed(2);

                if (profit >= 0) {
                    bot.sendMessage(
                        chatId,
                        `✅ Ordre de vente exécuté : PAYÉ !\n\n` +
                        `- Symbole : BTC / USDT\n` +
                        `- Gain réalisé 💵 : ${profit} USDT\n` +
                        `- Pourcentage réalisé 📊 : ${profitPercentage} %\n\n` +
                        `- Gains totaux 🪙 : ${totalProfit.toFixed(2)} USDT, ${totalProfitPercentage} %\n\n` +
                        `💪 On continue comme ça !`
                    );
                } else {
                    bot.sendMessage(
                        chatId,
                        `✅ Ordre de vente exécuté : Pas payé.\n\n` +
                        `- Symbole : BTC / USDT\n` +
                        `- Perte réalisée 💵 : ${Math.abs(profit)} USDT\n` +
                        `- Pourcentage réalisé 📉 : ${profitPercentage} %\n\n` +
                        `- Gains totaux 🪙 : ${totalProfit.toFixed(2)} USDT, ${totalProfitPercentage} %\n\n` +
                        `🧘 "Les pertes font partie du jeu, restons motivés !"`
                    );
                }
            } else {
                bot.sendMessage(chatId, `⚠️ Impossible de calculer les gains ou pertes : Dernier prix d'achat inconnu.`);
            }

            // Vérification du solde BTC pour une vente
            if (btcBalance <= 0) {
                console.error('Solde insuffisant en BTC pour vendre.');
                return res.status(400).send('Solde BTC insuffisant.');
            }

            // Exécution de l'ordre de vente
            const order = await binance.marketSell(symbol, quantityToSell);
            console.log('Ordre de vente effectué :', order);

            // // Calcul des gains ou pertes
            // const profitOrLoss = ((price - lastBuyPrice) * btcBalance).toFixed(2);
            // const profitOrLossPercentage = (((price - lastBuyPrice) / lastBuyPrice) * 100).toFixed(2);

            // // Notification Telegram
            // bot.sendMessage(
            //     chatId,
            //     `✅ Ordre de vente exécuté :\n- Symbole : ${symbol}\n- Quantité : ${quantityToSell}\n- Prix : ${price} USDT\n📊 Résultat du trade : ${profitOrLoss} USDT (${profitOrLossPercentage}%)`
            // );

            res.status(200).send('Ordre de vente exécuté avec succès !');
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
