const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

async function getMaxBorrowable(asset, isolatedSymbol) {
    console.log('fonction on =>', asset, isolatedSymbol);
    
    const base = 'https://api.binance.com';
    const path = '/sapi/v1/margin/maxBorrowable';
    const timestamp = Date.now();

    const params = { asset, isolatedSymbol, timestamp };    
    console.log('les params =>', params);
    
    const query = new URLSearchParams(params).toString();
    const signature = crypto.createHmac('sha256', process.env.BINANCE_MARGIN_API_SECRET)
        .update(query)
        .digest('hex');
        
    const url = `${base}${path}?${query}&signature=${signature}`;    
    const res = await axios.get(url, { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY }});
    console.log('réponse axios =>', res);
    
    console.log('getMaxBorrowable success =>', parseFloat(res.data.amount));
    
    return parseFloat(res.data.amount);
}

module.exports = { getMaxBorrowable };
