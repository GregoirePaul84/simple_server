const axios = require('axios');

// Générer un listenToken pour le portefeuille Margin isolé (nouveau système Binance 2026)
const getIsolatedMarginListenToken = async (symbol) => {
    try {
        const response = await axios.post(
            'https://api.binance.com/sapi/v1/userListenToken',
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
        );

        console.log(`Réponse brute userListenToken pour ${symbol} :`, JSON.stringify(response.data));

        if (!response.data?.token) {
            throw new Error('Aucun token reçu pour le portefeuille Margin isolé.');
        }

        console.log(`Token généré pour ${symbol} :`, response.data.token);
        return { token: response.data.token, expirationTime: response.data.expirationTime };
    } catch (error) {
        console.error('Erreur lors de la génération du listenToken Margin isolé :', error.message);
        throw error;
    }
};

module.exports = { getIsolatedMarginListenToken };
