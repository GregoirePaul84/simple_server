const axios = require('axios');

// Générer un listenKey pour le portefeuille Margin isolé
const getIsolatedMarginListenKey = async (symbol) => {
    try {
        const response = await axios.post(
            `https://api.binance.com/sapi/v1/userDataStream/isolated?symbol=${symbol}`,
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
        );

        if (!response.data || !response.data.listenKey) {
            throw new Error('Aucune listenKey reçue pour le portefeuille Margin isolé.');
        }

        console.log(`ListenKey générée pour le portefeuille Margin isolé (${symbol}) :`, response.data.listenKey);
        return response.data.listenKey;
    } catch (error) {
        console.error('Erreur lors de la génération du listenKey Margin isolé :', error.message);
        throw error;
    }
};

// Renouveler le listenKey
const keepAliveMarginListenKey = async (listenKey) => {
    try {
        await axios.put(
            `https://api.binance.com/sapi/v1/userDataStream`,
            null,
            {
                headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY },
                params: { listenKey },
            }
        );
        console.log('ListenKey renouvelé avec succès pour le portefeuille Margin.');
    } catch (error) {
        console.error('Erreur lors du renouvellement du listenKey Margin :', error.message);
    }
};

module.exports = { getIsolatedMarginListenKey, keepAliveMarginListenKey };
