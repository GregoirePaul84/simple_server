const { WebsocketClient } = require('okx-api');

/**
 * Crée et retourne un WebsocketClient OKX abonné au canal privé 'orders'
 * pour les instruments SWAP listés dans `symbols`.
 *
 * @param {string[]} symbols  - ex: ['BTC-USDC-SWAP', 'DOGE-USDC-SWAP']
 * @param {Function} onOrderFill - callback({ instId, side, avgPx, accFillSz, algoId })
 * @param {object}   bot     - instance Telegram pour les notifications de reconnexion
 * @param {string}   chatId
 * @returns {WebsocketClient}
 */
function createOkxWebSocket({ symbols, onOrderFill, bot, chatId }) {
    const wsClient = new WebsocketClient({
        apiKey:    process.env.OKX_API_KEY,
        apiSecret: process.env.OKX_API_SECRET,
        apiPass:   process.env.OKX_PASSPHRASE,
        market:    'EEA',  // wss://wseea.okx.com:8443/ws/v5/private
    });

    // Souscription canal privé 'orders' pour chaque symbol SWAP
    const subscriptions = symbols.map(instId => ({
        channel:  'orders',
        instType: 'SWAP',
        instId,
    }));

    wsClient.on('open', () => {
        console.log('[WS OKX] Connecté.');
    });

    wsClient.on('update', (data) => {
        if (data.arg?.channel !== 'orders') return;
        const orders = Array.isArray(data.data) ? data.data : [];

        for (const order of orders) {
            if (order.state !== 'filled') continue;
            if (!symbols.includes(order.instId)) continue;

            // Les ordres d'entrée sont des market sans algoId.
            // Les clôtures OCO ont toujours un algoId renseigné.
            if (!order.algoId && order.ordType === 'market') {
                console.log(`[WS OKX] Ordre market d'entrée ignoré (${order.instId})`);
                continue;
            }

            console.log(`[WS OKX] Fill clôture détecté : ${order.instId} side=${order.side} avgPx=${order.avgPx} qty=${order.accFillSz}`);
            onOrderFill(order);
        }
    });

    wsClient.on('error', (err) => {
        console.error('[WS OKX] Erreur :', err?.message || err);
    });

    wsClient.on('reconnect', () => {
        console.log('[WS OKX] Reconnexion en cours...');
        if (bot && chatId) {
            bot.sendMessage(chatId, '⚠️ WebSocket OKX : reconnexion en cours...').catch(() => {});
        }
    });

    wsClient.on('reconnected', () => {
        console.log('[WS OKX] Reconnecté.');
        if (bot && chatId) {
            bot.sendMessage(chatId, '✅ WebSocket OKX reconnecté.').catch(() => {});
        }
    });

    wsClient.subscribe(subscriptions);

    return wsClient;
}

module.exports = { createOkxWebSocket };
