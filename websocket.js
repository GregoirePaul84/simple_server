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
const keepAliveMarginListenKey = async (listenKey, symbol) => {
    try {
        console.log(`Renouvellement de la listenKey : ${listenKey}`);

        const response = await axios.put(
            `https://api.binance.com/sapi/v1/userDataStream/isolated`, // Correction de l'URL
            null,
            {
                headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY },
                params: { listenKey, symbol } // Paramètre ici et non dans l'URL
            }
        );

        console.log('✅ ListenKey renouvelé avec succès pour le portefeuille Margin.', response.data);
    } catch (error) {
        console.error('❌ Erreur lors du renouvellement du listenKey Margin :', error.response?.data || error.message);

        // Vérifie si l'erreur est due à une clé expirée et régénère un listenKey
        if (error.response?.status === 400) {
            console.error('🔄 ListenKey invalide ou expirée. Génération d\'une nouvelle clé...');
            return await getIsolatedMarginListenKey('BTCUSDC'); // Fonction pour générer une nouvelle listenKey
        }
    }
};

module.exports = { getIsolatedMarginListenKey, keepAliveMarginListenKey };
