const axios = require('axios');
require('dotenv').config();

async function getIsolatedListenKey(symbol) {
    const response = await axios.post(
        `https://api.binance.com/sapi/v1/userDataStream/isolated?symbol=${symbol}`,
        null,
        { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
    );

    if (!response.data?.listenKey) {
        throw new Error(`Pas de listenKey reçu pour ${symbol}.`);
    }

    console.log(`ListenKey ${symbol} :`, response.data.listenKey);
    return response.data.listenKey;
}

async function keepAliveListenKey(symbol, listenKey) {
    await axios.put(
        `https://api.binance.com/sapi/v1/userDataStream/isolated?symbol=${symbol}&listenKey=${listenKey}`,
        null,
        { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
    );
    console.log(`Keep-alive OK pour ${symbol}`);
}

module.exports = { getIsolatedListenKey, keepAliveListenKey };
