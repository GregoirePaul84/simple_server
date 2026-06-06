const axios = require('axios');
require('dotenv').config();

async function getIsolatedMarginListenToken() {
    try {
        const response = await axios.post(
            'https://api.binance.com/sapi/v1/userListenToken',
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
        );

        if (!response.data?.token) {
            throw new Error('Aucun token reçu pour le portefeuille Margin isolé.');
        }

        console.log('Token généré :', response.data.token);
        return { token: response.data.token, expirationTime: response.data.expirationTime };
    } catch (error) {
        console.error('Erreur lors de la génération du listenToken :', error.message);
        throw error;
    }
}

module.exports = { getIsolatedMarginListenToken };
