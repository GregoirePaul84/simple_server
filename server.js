require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Binance = require('node-binance-api');

const externalURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

// Instance Express
const app = express();
const port = 3000;

// Middleware pour traiter les JSON reçus par tradingview
app.use(bodyParser.json());

// Configuration de Binance API
const binance = new Binance().options({
    APIKEY: process.env.BINANCE_API_KEY, 
    APISECRET: process.env.BINANCE_API_SECRET,
});

// Route pour tester la connexion
app.get('/', (req, res) => {
    res.send('Le serveur fonctionne correctement !');
});

// Endpoint pour récupérer le solde
app.get('/balance', async (_, res) => {
    try {
        const accountInfo = await binance.balance(); // Récupère le solde complet
        const usdtBalance = accountInfo.USDT.available; // Solde USDT disponible
        res.status(200).json({
            message: 'Solde récupéré avec succès',
            usdtBalance,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du solde :', error);
        res.status(500).json({ error: 'Impossible de récupérer le solde' });
    }
});

// Endpoint Webhook pour recevoir les alertes de TradingView
app.post('/webhook', async (req, res) => {
    // Alerte tradingview reçue
    const { action, symbol, key } = req.body;

    // Vérification de la clé secrète
    if (key !== process.env.WEBHOOK_SECRET) {
        return res.status(401).send('Clé secrète incorrecte.');
    }

    try {
        // Récupération du solde total disponible pour le trading
        const accountInfo = await binance.balance();
        const usdtBalance = parseFloat(accountInfo.USDT.available);

        // Vérification des positions ouvertes
        const openOrders = await binance.openOrders(symbol);
        if (openOrders.length > 0) {
            console.error(`Une position est déjà ouverte pour ${symbol}.`);
            return res.status(400).send('Position déjà ouverte.');
        }

        // Prix actuel BTC / USDT
        const prices = await binance.prices();
        const price = parseFloat(prices[symbol]);

        // Calcul la quantité basée sur le solde total
        const quantity = (usdtBalance / price).toFixed(6);

        // Erreur si solde insuffisant
        if (usdtBalance <= 0) {
            console.error('Solde insuffisant pour exécuter l\'ordre.');
            return res.status(400).send('Solde insuffisant.');
        }

        // Exécute un ordre d'achat ou de vente selon l'alerte (ordre market)
        if (action === 'buy') {
            const order = await binance.marketBuy(symbol, quantity);
            console.log('Ordre d\'achat effectué :', order);
            res.status(200).send('Ordre d\'achat exécuté avec succès !');
        } else if (action === 'sell') {
            const order = await binance.marketSell(symbol, quantity);
            console.log('Ordre de vente effectué :', order);
            res.status(200).send('Ordre de vente exécuté avec succès !');
        }
    } catch (error) {
        console.error('Erreur lors de l\'exécution de l\'ordre :', error);
        res.status(500).send('Erreur lors de l\'exécution de l\'ordre.');
    }
});


// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur ${externalURL}`);
});
