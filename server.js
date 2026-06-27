require("dotenv").config();
const express    = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const { getOkxClient } = require("./okxClient");
const { getBalanceData } = require("./getBalanceData");
const { takeLongPosition } = require("./actions/takeLongPosition");
const { takeShortPosition } = require("./actions/takeShortPosition");
const { placeOCOOrder } = require("./actions/placeOcoOrder");
const { scheduleMonthlyReport, sendMonthlyReport } = require("./monthlyReport");
const { handleCloseLong } = require("./actions/handleCloseLong");
const { handleCloseShort } = require("./actions/handleCloseShort");
const { createOkxWebSocket } = require("./websocket");
const { getPositionStatus } = require("./getPositionStatus");

// Configuration de Telegram
const bot    = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

// Instance Express
const app  = express();
const port = 3000;
const externalURL = `http://localhost:${port}`;

app.use(bodyParser.json());

// Variables de base
const initialCapital = 2000; // Capital initial par actif en USDC
const totalCapital   = initialCapital * 2; // BTC + DOGE

const symbols = ["BTC-USD_UM_XPERP-310404", "DOGE-USD_UM_XPERP-310404"];

const initialPrices = {
    "BTC-USD_UM_XPERP-310404":  null,
    "DOGE-USD_UM_XPERP-310404": null,
};
const profits = {
    "BTC-USD_UM_XPERP-310404":  { monthly: 0, cumulative: 0 },
    "DOGE-USD_UM_XPERP-310404": { monthly: 0, cumulative: 0 },
};

// Taille de contrat par symbol — peuplée au startup depuis getInstruments
const contractSizes = {
    "BTC-USD_UM_XPERP-310404":  null,
    "DOGE-USD_UM_XPERP-310404": null,
};

// Lock anti double traitement, un par symbole
const orderHandled      = new Map(symbols.map(s => [s, false]));
// Lock anti double webhook, un par symbole
const webhookProcessing = new Map(symbols.map(s => [s, false]));

let wsClient = null;

const startUserWebSocket = () => {
    wsClient = createOkxWebSocket({
        symbols,
        bot,
        chatId,
        onOrderFill: async (order) => {
            const symbol = order.instId;

            if (orderHandled.get(symbol)) {
                console.warn(`⛔ Event ignoré car déjà traité pour ${symbol}`);
                return;
            }
            orderHandled.set(symbol, true);
            console.log(`✅ Ordre OCO exécuté pour ${symbol}`);

            const executedPrice    = parseFloat(order.avgPx);
            const filledContracts  = parseFloat(order.accFillSz);
            const ctVal            = contractSizes[symbol] || 1;
            const executedQuantity = filledContracts * ctVal;

            try {
                if (order.side === 'sell') {
                    await handleCloseLong(
                        symbol,
                        initialPrices[symbol],
                        executedPrice,
                        executedQuantity,
                        initialCapital,
                        profits[symbol],
                        bot,
                        chatId
                    );
                } else if (order.side === 'buy') {
                    await handleCloseShort(
                        symbol,
                        initialPrices[symbol],
                        executedPrice,
                        executedQuantity,
                        initialCapital,
                        profits[symbol],
                        bot,
                        chatId
                    );
                }
                orderHandled.set(symbol, false);
            } catch (error) {
                console.error(`❌ Erreur traitement WebSocket pour ${symbol}:`, error.message);
                bot.sendMessage(chatId, `❌ Erreur traitement OCO ${symbol}: ${error.message}`);
                orderHandled.set(symbol, false);
            }
        },
    });

    // Notification Telegram toutes les 12h pour confirmer que le WebSocket est actif
    setInterval(() => {
        const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        bot.sendMessage(chatId, `✅ WebSocket OKX actif\n🕐 ${now}`);
    }, 12 * 60 * 60 * 1000);
};

// Setter pour réinitialiser les profits mensuels
const resetMonthlyProfit = () => {
    profits["BTC-USD_UM_XPERP-310404"].monthly  = 0;
    profits["DOGE-USD_UM_XPERP-310404"].monthly = 0;
    console.log("Profit mensuel réinitialisé.");
};

// Routes
app.get("/", (_, res) => res.send("Le serveur fonctionne correctement !"));

app.use((req, res, next) => {
    console.log(`Requête reçue de : ${req.ip}`);
    next();
});

app.get("/buy-test", (_, res) => {
    const symbol      = "BTC / USDC";
    const price       = 1000;
    const stopLoss    = price * 0.96;
    const takeProfit  = price * 1.08;
    bot.sendMessage(
        chatId,
        `✅ Ordre d'achat exécuté :\n` +
        `        - Symbole : ${symbol}\n` +
        `        - Prix : ${price} USDC\n` +
        `        - Gain potentiel : ${takeProfit - price} USDC\n` +
        `        - Perte potentielle : ${stopLoss - price} USDC\n`
    );
    res.status(200).send("Rapport mensuel envoyé (test).");
});

app.get("/test-monthly-report", (_, res) => {
    sendMonthlyReport(
        bot,
        chatId,
        profits["BTC-USD_UM_XPERP-310404"].cumulative + profits["DOGE-USD_UM_XPERP-310404"].cumulative,
        totalCapital,
        profits["BTC-USD_UM_XPERP-310404"].monthly + profits["DOGE-USD_UM_XPERP-310404"].monthly
    );
    res.status(200).send("Rapport mensuel envoyé (test).");
});

app.get("/balance", async (_, res) => {
    try {
        const data = await getBalanceData("BTC-USD_UM_XPERP-310404");
        res.status(200).json({
            message:      "Solde OKX récupéré avec succès",
            usdcBalance:  data.quoteAsset.free,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de la balance :", error.message);
        res.status(500).json({ error: "Impossible de récupérer la balance" });
    }
});

// Endpoint Webhook pour recevoir les alertes de TradingView
app.post("/webhook", async (req, res) => {
    const { action, type, symbol, key } = req.body;

    if (key !== process.env.WEBHOOK_SECRET) {
        console.log("clé secrète incorrecte");
        return res.status(401).send("Clé secrète incorrecte.");
    }

    // Rejet immédiat si le symbole ne correspond pas exactement à un instrument connu
    // (protège contre les typos TradingView, ex: tiret au lieu d'underscore dans UM_XPERP)
    if (!symbols.includes(symbol)) {
        console.warn(`⛔ Symbole inconnu reçu : "${symbol}". Attendu : ${symbols.join(' | ')}`);
        await bot.sendMessage(chatId, `⛔ Webhook rejeté : symbole inconnu "${symbol}"\nAttendus : ${symbols.join(', ')}`);
        return res.status(400).send(`Symbole non supporté : ${symbol}`);
    }

    if (webhookProcessing.get(symbol)) {
        console.warn(`⛔ Webhook ignoré : traitement déjà en cours pour ${symbol}`);
        await bot.sendMessage(chatId, `⚠️ Webhook dupliqué ignoré pour ${symbol} (traitement en cours).`);
        return res.status(200).send("Webhook dupliqué ignoré.");
    }

    webhookProcessing.set(symbol, true);

    try {
        console.log("début du webhook");

        // Prix actuel via ticker OKX
        const okxClient = getOkxClient();
        const tickerRes = await okxClient.getTicker({ instId: symbol });
        const price     = parseFloat(tickerRes.data[0].last);
        console.log(`Prix actuel de l'actif pour ${symbol} => ${price} USDC`);

        // Vérifier s'il y a déjà une position ouverte
        const positionStatus = await getPositionStatus(symbol);
        console.log(`Status position pour ${symbol} :`, positionStatus);

        if (positionStatus.hasOpenPosition) {
            const direction = positionStatus.hasLong ? "LONG" : "SHORT";
            const msg =
                `⚠️ Trade bloqué sur ${symbol} :\n` +
                `                        - Position déjà ouverte côté OKX\n` +
                `                        - Direction: ${direction}\n` +
                `                        - Long notionnel: ${positionStatus.longNotional.toFixed(2)} USDC\n` +
                `                        - Short notionnel: ${positionStatus.shortNotional.toFixed(2)} USDC\n\n` +
                `                        Trade manuel requis.`;
            console.warn(msg);
            await bot.sendMessage(chatId, msg);
            return res.status(200).send("Trade bloqué : position déjà ouverte sur OKX.");
        }

        // ****** GESTION POSITION LONGUE ****** //
        if (action === "LONG") {
            let balanceData  = await getBalanceData(symbol);
            const usdcBalance = parseFloat(balanceData.quoteAsset.free);
            console.log(`balance USDC avant position longue pour ${symbol} =>`, usdcBalance);

            const longOrder = await takeLongPosition(symbol, type, price, usdcBalance, bot, chatId);

            initialPrices[symbol]    = longOrder.initialPrice;
            contractSizes[symbol]    = longOrder.ctVal;
            const assetsBought       = parseFloat(longOrder.order.executedQty);
            console.log(`Actifs achetés sur ${initialPrices[symbol]} pour ${symbol}`);

            const feeRate        = 0.001;
            const assetsAvailable = assetsBought * (1 - feeRate);
            console.log(`Actifs réellement disponibles après frais: ${assetsAvailable}`);

            await placeOCOOrder(symbol, type, "BUY", price, assetsAvailable, bot, chatId);
        }

        // ****** GESTION POSITION COURTE ****** //
        else if (action === "SHORT") {
            let balanceData   = await getBalanceData(symbol);
            const usdcBalance = parseFloat(balanceData.quoteAsset.free);
            console.log("balance USDC avant position courte =>", usdcBalance);

            const shortOrder = await takeShortPosition(symbol, type, price, usdcBalance, bot, chatId);

            initialPrices[symbol] = shortOrder.initialPrice;
            contractSizes[symbol] = shortOrder.ctVal;
            const assetsSold      = parseFloat(shortOrder.order.executedQty);
            console.log(`Actifs shortés sur ${initialPrices[symbol]} pour ${symbol}`);

            await placeOCOOrder(symbol, type, "SELL", price, assetsSold, bot, chatId);
        }

        res.status(200).send("Ordre effectué avec succès.");
    } catch (error) {
        console.error("Erreur générale :", error.message);
        bot.sendMessage(chatId, `❌ Erreur : ${error.message}`);
        res.status(500).json({ message: "Erreur lors de l'exécution de l'ordre.", error: error.message });
    } finally {
        webhookProcessing.set(symbol, false);
    }
});

// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur ${externalURL}`);
});

const runStartupChecks = async () => {
    console.log("🔍 Démarrage des tests de santé...");

    // 1. Variables d'environnement
    const requiredEnvVars = [
        "OKX_API_KEY",
        "OKX_API_SECRET",
        "OKX_PASSPHRASE",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "WEBHOOK_SECRET",
    ];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
        throw new Error(`Variables d'environnement manquantes : ${missingVars.join(", ")}`);
    }
    console.log("✅ Variables d'environnement OK");

    // 2. Connexion OKX (heure serveur)
    const okxClient = getOkxClient();
    await okxClient.getServerTime();
    console.log("✅ OKX API accessible");

    // 3. Clé API OKX valide (balance)
    await okxClient.getAccountBalance({ ccy: 'USDC' });
    console.log("✅ Clé API OKX valide");

    // 4. Récupère les tailles de contrat et impose le levier x1 pour chaque symbol
    for (const symbol of symbols) {
        const instrRes = await okxClient.getInstruments({ instType: 'FUTURES', instId: symbol });
        contractSizes[symbol] = parseFloat(instrRes.data[0].ctVal);
        console.log(`✅ ${symbol} ctVal = ${contractSizes[symbol]}`);

        // Impose levier x1 en isolated pour ne pas trader avec levier involontaire
        await okxClient.setLeverage({ instId: symbol, lever: '1', mgnMode: 'isolated' });
        console.log(`✅ ${symbol} levier x1 isolated confirmé`);
    }

    // 5. Telegram bot
    const me = await bot.getMe();
    console.log(`✅ Telegram bot connecté : @${me.username}`);

    console.log("🚀 Tous les tests de santé passés. Démarrage du serveur...");
};

const init = async () => {
    try {
        await runStartupChecks();
    } catch (err) {
        console.error("❌ Echec des tests de santé au démarrage :", err.message);
        console.error("⚠️  Le serveur démarre quand même, mais des fonctionnalités peuvent être indisponibles.");
    }

    startUserWebSocket();
    scheduleMonthlyReport(
        bot,
        chatId,
        () => profits["BTC-USD_UM_XPERP-310404"].cumulative + profits["DOGE-USD_UM_XPERP-310404"].cumulative,
        () => profits["BTC-USD_UM_XPERP-310404"].monthly     + profits["DOGE-USD_UM_XPERP-310404"].monthly,
        resetMonthlyProfit,
        totalCapital
    );
};

init().catch(err => {
    console.error("❌ Erreur fatale init :", err.message);
    process.exit(1);
});
