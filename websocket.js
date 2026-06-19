const axios = require('axios');
require('dotenv').config();

async function getListenToken() {
    const res = await axios.post(
        'https://api.binance.com/sapi/v1/userListenToken',
        null,
        { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
    );
    if (!res.data?.token) throw new Error('Aucun listenToken reçu de Binance');
    const minutesLeft = Math.round((res.data.expirationTime - Date.now()) / 60000);
    console.log(`ListenToken créé, expire dans ${minutesLeft} min`);
    return { token: res.data.token, expirationTime: res.data.expirationTime };
}

module.exports = { getListenToken };
