const crypto = require('crypto');
const axios = require('axios');

// Connexion au portefeuille de marge isolée
async function getIsolatedMarginAccount(apiKey, apiSecret) {
    const baseUrl = 'https://api.binance.com';
    const endpoint = '/sapi/v1/margin/isolated/account';
    const timestamp = Date.now();

    // Créez la query string pour l'authentification
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    // URL complète avec signature
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    // Requête HTTP avec Axios
    const response = await axios.get(url, {
        headers: {
            'X-MBX-APIKEY': apiKey,
        },
    });

    return response.data; // Retourne les données de l'API
}

module.exports = { getIsolatedMarginAccount };