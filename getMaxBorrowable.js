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
    
    const amount = parseFloat(res.data.amount);
    const borrowLimit = parseFloat(res.data.borrowLimit);
    console.log('getMaxBorrowable success => amount:', amount, '| borrowLimit:', borrowLimit);

    return Math.min(amount, borrowLimit);
}

module.exports = { getMaxBorrowable };
