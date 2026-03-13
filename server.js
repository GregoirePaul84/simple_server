require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Binance = require("binance-api-node").default;
const { ErrorCodes } = require("binance-api-node");
const TelegramBot = require("node-telegram-bot-api");
const { getIsolatedMarginAccount } = require("./getIsolatedMarginAccount");
const { getBalanceData } = require("./getBalanceData");
const { takeLongPosition } = require("./actions/takeLongPosition");
const { takeShortPosition } = require("./actions/takeShortPosition");
const { placeOCOOrder } = require("./actions/placeOcoOrder");
const { scheduleMonthlyReport, sendMonthlyReport } = require("./monthlyReport"); // Import du fichier pour le rapport mensuel
const { handleCloseLong } = require("./actions/handleCloseLong");
const { handleCloseShort } = require("./actions/handleCloseShort");
const WebSocket = require("ws");
const { getIsolatedMarginListenToken } = require("./websocket");
const { repayDebtForSymbol } = require("./repayDebtForSymbol");
const { getPositionStatus } = require("./getPositionStatus");

// Configuration de Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

// Instance Express
const app = express();
const port = 3000;

const externalURL = `http://localhost:${port}`;

// Middleware pour traiter les JSON reçus par tradingview
app.use(bodyParser.json());

// Configuration de Binance API pour le swing trading
const binanceMargin = Binance({
  apiKey: process.env.BINANCE_MARGIN_API_KEY,
  apiSecret: process.env.BINANCE_MARGIN_API_SECRET,
  reconnect: true, // Permet de se reconnecter automatiquement
  verbose: true, // Affiche les logs pour aider au débogage
  getTime: () => Date.now(),
});

// Variables de base

const initialCapital = 2000; // Capital initial par actif en USDC
const totalCapital = initialCapital * 2; // BTC + DOGE
const initialPrices = {
  BTCUSDC: null,
  DOGEUSDC: null,
};
const profits = {
  BTCUSDC: { monthly: 0, cumulative: 0 },
  DOGEUSDC: { monthly: 0, cumulative: 0 },
};

const wsBySymbol = new Map();
const keepAliveBySymbol = new Map();

// Connecter le WebSocket utilisateur pour détecter le passage des ordres OCO
const createWebSocketForSymbol = async (symbol) => {
  // ✅ Nettoyage si on relance
  const oldWs = wsBySymbol.get(symbol);
  if (oldWs) {
    try {
      oldWs.terminate?.();
    } catch {}
    wsBySymbol.delete(symbol);
  }

  const oldTimer = keepAliveBySymbol.get(symbol);
  if (oldTimer) {
    clearInterval(oldTimer);
    keepAliveBySymbol.delete(symbol);
  }

  const { token, expirationTime } = await getIsolatedMarginListenToken(symbol);
  const ws = new WebSocket("wss://ws-api.binance.com:443/ws-api/v3");
  wsBySymbol.set(symbol, ws);

  ws.on("open", () => {
    ws.send(JSON.stringify({
      id: `sub-${symbol}`,
      method: "userDataStream.subscribe.listenToken",
      params: { listenToken: token },
    }));
    console.log(`WebSocket connecté pour ${symbol}, subscription envoyée.`);
  });

  // Refresh du token 1h avant expiration (~24h)
  const msUntilExpiry = expirationTime - Date.now();
  const refreshDelay = Math.max(msUntilExpiry - 60 * 60 * 1000, 5000);
  const refreshTimer = setTimeout(() => {
    console.log(`🔄 Token expiré pour ${symbol}, reconnexion...`);
    try { ws.terminate(); } catch {}
  }, refreshDelay);
  keepAliveBySymbol.set(symbol, refreshTimer);

  // ✅ Watchdog : détecte les déconnexions silencieuses via les pings Binance (~3min)
  let lastPingAt = Date.now();

  ws.on("ping", () => {
    lastPingAt = Date.now();
    ws.pong();
  });

  const pingWatchdog = setInterval(() => {
    if (Date.now() - lastPingAt > 5 * 60 * 1000) {
      console.warn(`⚠️ Aucun ping reçu depuis 5min pour ${symbol}, reconnexion forcée`);
      clearInterval(pingWatchdog);
      ws.terminate();
    }
  }, 60 * 1000);

  // Lock anti double traitement sur le même WS
  let orderHandled = false;

  ws.on("message", async (data) => {
    const message = JSON.parse(data);

    // Réponse de subscription (nouveau WS API : { id, status, result })
    if (message.status !== undefined) {
      if (message.status === 200) {
        console.log(`✅ Subscription WebSocket confirmée pour ${symbol}`);
      } else {
        console.error(`❌ Erreur subscription WebSocket pour ${symbol}:`, message);
      }
      return;
    }

    // Les events arrivent soit dans message.data (WS API), soit directement
    const event = message.data || message;
    console.log(`Message WebSocket reçu pour ${symbol}:`, event);

    // On ne garde que ce qui concerne les ordres exécutés
    if (event.e !== "executionReport") return;
    if (event.s !== symbol) return; // filtre par paire (token unifié = events pour toutes les paires)
    if (event.X !== "FILLED") return;

    // On ne garde que la fermeture d’un OCO (STOP ou LIMIT)
    if (!["STOP_LOSS_LIMIT", "LIMIT_MAKER"].includes(event.o)) return;

    // Protège contre les partial fills ou plusieurs events
    if (orderHandled) {
      console.warn(`⛔ Event ignoré car déjà traité pour ${symbol}`);
      return;
    }

    orderHandled = true;

    console.log(`✅ Ordre OCO exécuté pour ${event.s}`);

    const executedPrice = parseFloat(event.p);
    const executedQuantity = parseFloat(event.q);

    try {
      if (event.S === "SELL") {
        // Fermeture d’un LONG
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
      } else if (event.S === "BUY") {
        // Fermeture d’un SHORT
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
      orderHandled = false; // ✅ Réinitialisation pour le prochain trade
    } catch (error) {
      console.error(
        `❌ Erreur lors du traitement WebSocket pour ${symbol}:`,
        error.message
      );
      orderHandled = false; // On annule le verrou pour retenter si crash
    }
  });

  ws.on("error", (err) => {
    console.error(`Erreur WebSocket pour ${symbol}:`, err);
  });

  ws.on("close", () => {
    console.log(`WebSocket pour ${symbol} fermé. Reconnexion dans 5s...`);

    // ✅ IMPORTANT : stop le keepAlive
    const t = keepAliveBySymbol.get(symbol);
    if (t) clearInterval(t);
    keepAliveBySymbol.delete(symbol);
    wsBySymbol.delete(symbol);

    setTimeout(() => createWebSocketForSymbol(symbol), 5000);
  });

};

const startUserWebSocket = async () => {
  const symbols = ["BTCUSDC", "DOGEUSDC"];
  for (const symbol of symbols) {
    await createWebSocketForSymbol(symbol);
  }
};

// Setter pour réinitialiser les profits mensuels
const resetMonthlyProfit = () => {
  profits.BTCUSDC.monthly = 0;
  profits.DOGEUSDC.monthly = 0;
  console.log("Profit mensuel réinitialisé.");
};

// Route pour tester la connexion
app.get("/", (_, res) => {
  res.send("Le serveur fonctionne correctement !");
});

app.use((req, res, next) => {
  console.log(`Requête reçue de : ${req.ip}`);
  next();
});

// Test du message d'achat du bot
app.get("/buy-test", (_, res) => {
  const symbol = "BTC / USDC";
  const quantity = 0.00015;
  const price = 1000;
  const stopLoss = price * 0.96;
  const takeProfit = price * 1.08;
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
  res.status(200).send("Rapport mensuel envoyé (test).");
});

// Test du compte rendu mensuel
app.get("/test-monthly-report", (_, res) => {
  // Appel direct à la fonction pour générer un rapport
  sendMonthlyReport(
    bot,
    chatId,
    profits.BTCUSDC.cumulative + profits.DOGEUSDC.cumulative,
    totalCapital,
    profits.BTCUSDC.monthly + profits.DOGEUSDC.monthly
  );
  res.status(200).send("Rapport mensuel envoyé (test).");
});

app.get("/balance", async (_, res) => {
  try {
    // Appel à l'API pour récupérer le portefeuille de marge isolée
    const data = await getIsolatedMarginAccount(
      process.env.BINANCE_MARGIN_API_KEY,
      process.env.BINANCE_MARGIN_API_SECRET
    );

    // Recherche de la paire BTCUSDC
    const btcUsdcData = data.assets.find((asset) => asset.symbol === "BTCUSDC");

    if (!btcUsdcData) {
      throw new Error(
        "La paire BTCUSDC n'a pas été trouvée dans le portefeuille isolé."
      );
    }

    // Extraire les balances pour BTC (baseAsset) et USDC (quoteAsset)
    const usdcBalance = btcUsdcData.quoteAsset.free;
    const btcBalance = btcUsdcData.baseAsset.free;

    res.status(200).json({
      message: "Solde de marge isolée récupéré avec succès",
      usdcBalance,
      btcBalance,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de la balance isolée :",
      error.message
    );
    res
      .status(500)
      .json({ error: "Impossible de récupérer la balance isolée" });
  }
});

// Endpoint Webhook pour recevoir les alertes de TradingView
app.post("/webhook", async (req, res) => {
  const { action, type, symbol, key } = req.body;

  // Vérification de la clé secrète
  if (key !== process.env.WEBHOOK_SECRET) {
    console.log("clé secrète incorrecte");
    return res.status(401).send("Clé secrète incorrecte.");
  }

  try {
    console.log("début du webhook");

    // Prix actuel BTC / USDC ou DOGE / USDC
    const prices = await binanceMargin.prices();
    const price = parseFloat(prices[symbol]);

    console.log(`Prix actuel de l'actif pour ${symbol} => ${price} USDC`);

    // 🧠 Vérifier s'il y a déjà une position significative ouverte
    const positionStatus = await getPositionStatus(symbol, price);
    console.log(`Status position pour ${symbol} :`, positionStatus);

    if (positionStatus.hasOpenPosition) {
      const direction = positionStatus.hasLong ? "LONG" : "SHORT";

      const msg = `⚠️ Trade bloqué sur ${symbol} :
                        - Position déjà ouverte côté Binance
                        - Direction: ${direction}
                        - Long notionnel: ${positionStatus.longNotional.toFixed(
                          2
                        )} USDC
                        - Short notionnel: ${positionStatus.shortNotional.toFixed(
                          2
                        )} USDC

                        Trade manuel requis.`;

      console.warn(msg);
      await bot.sendMessage(chatId, msg);

      return res
        .status(200)
        .send("Trade bloqué : position déjà ouverte sur Binance.");
    }

    // ****** GESTION POSITION LONGUE  ****** //

    // ACHAT LONG
    if (action === "LONG") {
      // Récupération de la balance USDC avant l'achat
      let balanceData = await getBalanceData(symbol);
      const usdcBalance = parseFloat(balanceData.quoteAsset.free);
      console.log(
        `balance USDC avant position longue pour ${symbol} =>`,
        usdcBalance
      );

      const longOrder = await takeLongPosition(
        binanceMargin,
        symbol,
        type,
        price,
        usdcBalance,
        bot,
        chatId
      );

      initialPrices[symbol] = longOrder.initialPrice;

      console.log(`Actifs achetés sur ${initialPrices[symbol]} pour ${symbol}`);

      const assetsBought = parseFloat(longOrder.order.executedQty); // Quantité exacte achetée
      console.log("Actifs achetés dans cet ordre :", assetsBought);

      const feeRate = 0.001;
      const assetsAvailable = assetsBought * (1 - feeRate); // Enlève les frais
      console.log(
        `Actifs réellement disponibles après frais: ${assetsAvailable}`
      );

      // Ordre OCO : gestion des SL et TP en limit
      await placeOCOOrder(
        binanceMargin,
        symbol,
        type,
        "BUY",
        price,
        assetsAvailable,
        bot,
        chatId
      );
    }

    // ****** GESTION POSITION COURTE  ****** //
    // VENTE SHORT
    else if (action === "SHORT") {
      // Récupération de la balance USDC avant la vente
      let balanceData = await getBalanceData(symbol);
      const usdcBalance = parseFloat(balanceData.quoteAsset.free);

      console.log("balance USDC avant position courte =>", usdcBalance);

      const shortOrder = await takeShortPosition(
        binanceMargin,
        symbol,
        type,
        price,
        usdcBalance,
        bot,
        chatId
      );

      initialPrices[symbol] = shortOrder.initialPrice;

      console.log(`Actifs shortés sur ${initialPrices[symbol]} pour ${symbol}`);

      const assetsSold = parseFloat(shortOrder.order.executedQty); // Quantité exacte vendue
      console.log("Nombre shorté dans cet ordre :", assetsSold);

      // Pour un SHORT, les frais de vente sont payés en USDC, pas en actif.
      // L'OCO doit racheter exactement la quantité empruntée pour éviter les résidus de dette.
      const assetsAvailable = assetsSold;
      console.log(
        `Actifs à racheter (quantité empruntée) : ${assetsAvailable}`
      );

      // Ordre OCO : gestion des SL et TP en limit
      await placeOCOOrder(
        binanceMargin,
        symbol,
        type,
        "SELL",
        price,
        assetsAvailable,
        bot,
        chatId
      );
    }

    res.status(200).send("Ordre effectué avec succès.");
  } catch (error) {
    console.log("le code erreur =>", error.code);

    if (error.code === ErrorCodes.INSUFFICIENT_BALANCE) {
      console.error("Erreur : Solde insuffisant pour effectuer l'ordre.");
    } else if (error.code === ErrorCodes.INVALID_ORDER_TYPE) {
      console.error("Erreur : Type d'ordre invalide.");
    } else if (error.code === -2010) {
      // "New order rejected"
      console.error(
        "Erreur : Nouvel ordre rejeté. Vérifiez les règles de la paire."
      );
    } else {
      console.error("Erreur générale :", error.message);
    }

    bot.sendMessage(chatId, `❌ Erreur : ${error.message}`);
    res.status(500).json({
      message: "Erreur lors de l'exécution de l'ordre.",
      error: error.message,
    });
    return { order: null, initialPrice: null };
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
    "BINANCE_MARGIN_API_KEY",
    "BINANCE_MARGIN_API_SECRET",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "WEBHOOK_SECRET",
  ];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missingVars.join(", ")}`);
  }
  console.log("✅ Variables d'environnement OK");

  // 2. Connexion Binance (ping)
  await binanceMargin.ping();
  console.log("✅ Binance API accessible");

  // 3. Clé API Binance valide (récupération du temps serveur + account check)
  await binanceMargin.accountInfo({ useServerTime: true });
  console.log("✅ Clé API Binance valide");

  // 4. Telegram bot
  const me = await bot.getMe();
  console.log(`✅ Telegram bot connecté : @${me.username}`);

  console.log("🚀 Tous les tests de santé passés. Démarrage du serveur...");
};

const init = async () => {
  try {
    await runStartupChecks();
  } catch (err) {
    console.error("❌ Echec des tests de santé au démarrage :", err.message);
    if (err.response?.data) console.error("   Détail Binance :", err.response.data);
    console.error("⚠️  Le serveur démarre quand même, mais des fonctionnalités peuvent être indisponibles.");
  }

  await startUserWebSocket(); // Données de Binance
  scheduleMonthlyReport(
    bot,
    chatId,
    () => profits.BTCUSDC.cumulative + profits.DOGEUSDC.cumulative,
    () => profits.BTCUSDC.monthly + profits.DOGEUSDC.monthly,
    resetMonthlyProfit,
    totalCapital
  ); // Rapport Telegram mensuel
};

init().catch((err) => {
  console.error("❌ Erreur fatale init :", err.message);
  process.exit(1);
});
