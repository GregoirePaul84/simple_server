const axios = require('axios');

// Générer un listenToken global (nouveau système Binance 2026)
// Un seul token couvre tous les symboles — ne pas appeler deux fois (un seul WS suffit)
const getIsolatedMarginListenToken = async () => {
    try {
        const response = await axios.post(
            'https://api.binance.com/sapi/v1/userListenToken',
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
        );

        console.log('Réponse brute userListenToken :', JSON.stringify(response.data));

        if (!response.data?.token) {
            throw new Error('Aucun token reçu pour le portefeuille Margin isolé.');
        }

        console.log('Token généré :', response.data.token);
        return { token: response.data.token, expirationTime: response.data.expirationTime };
    } catch (error) {
        console.error('Erreur lors de la génération du listenToken Margin isolé :', error.message);
        throw error;
    }
};

// Garder le token en vie (Binance expire le token si pas de PUT toutes les ~60min)
const keepAliveListenToken = async () => {
    try {
        await axios.put(
            'https://api.binance.com/sapi/v1/userListenToken',
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
        );
        console.log('🔄 Keep-alive listenToken OK');
    } catch (error) {
        console.error('Erreur keep-alive listenToken :', error.message);
    }
};

module.exports = { getIsolatedMarginListenToken, keepAliveListenToken };
