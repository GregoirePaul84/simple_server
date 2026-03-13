const axios = require('axios');

// Générer un listenToken pour le portefeuille Margin isolé (nouveau système Binance 2026)
const getIsolatedMarginListenToken = async (symbol) => {
    try {
        const response = await axios.post(
            'https://api.binance.com/sapi/v1/userListenToken',
            null,
            {
                headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY },
                params: { symbol, accountType: 'ISOLATED_MARGIN' }
            }
        );

        if (!response.data?.listenToken) {
            throw new Error('Aucun listenToken reçu pour le portefeuille Margin isolé.');
        }

        console.log(`ListenToken généré pour ${symbol} :`, response.data.listenToken);
        return response.data.listenToken;
    } catch (error) {
        console.error('Erreur lors de la génération du listenToken Margin isolé :', error.message);
        throw error;
    }
};

module.exports = { getIsolatedMarginListenToken };
