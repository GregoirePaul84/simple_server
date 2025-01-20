const axios = require('axios');

const getListenKey = async () => {
    try {
        const response = await axios.post(
            'https://api.binance.com/api/v3/userDataStream',
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY } }
        );

        if (!response.data || !response.data.listenKey) {
            throw new Error('Aucune listenKey reçue de Binance.');
        }

        console.log('ListenKey générée :', response.data.listenKey);
        return response.data.listenKey;
    } catch (error) {
        console.error('Erreur lors de la génération du listenKey :', error.message);
        throw error;
    }
};


const keepAliveListenKey = async (listenKey) => {
    try {
        await axios.put(
            `https://api.binance.com/api/v3/userDataStream`,
            null,
            {
                headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY },
                params: { listenKey },
            }
        );
        console.log('ListenKey renouvelé avec succès.');
    } catch (error) {
        console.error('Erreur lors du renouvellement du listenKey :', error.message);
    }
};


module.exports = { getListenKey, keepAliveListenKey };
