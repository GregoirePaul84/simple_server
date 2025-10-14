const crypto = require('crypto');
const axios = require('axios');

async function getIsolatedMarginAccount(apiKey, apiSecret) {
    console.log('Récupération des infos du compte marge isolée...');

    const baseUrl = 'https://api1.binance.com';
    const endpoint = '/sapi/v1/margin/isolated/account';
    const recvWindow = 5000;

    // Récupère l'heure exacte du serveur Binance
    const serverTime = (await axios.get(`${baseUrl}/api/v3/time`)).data.serverTime;

    console.log('Heure du serveur de binance =>', serverTime);

    const queryString = `timestamp=${serverTime}&recvWindow=${recvWindow}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
        const response = await axios.get(url, {
            headers: { 'X-MBX-APIKEY': apiKey },
        });
        console.log('✅ Compte marge isolée :', response.data);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('❌ Erreur API Binance :', error.response.status, error.response.data);
        } else {
            console.error('⚠️ Erreur de connexion :', error.message);
        }
    }
}

module.exports = { getIsolatedMarginAccount };
