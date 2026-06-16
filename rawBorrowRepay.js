const axios = require('axios');
const crypto = require('crypto');

async function rawBorrowRepay({ asset, symbol, amount, type, apiKey, apiSecret }) {
    const base = 'https://api.binance.com';
    const path = '/sapi/v1/margin/borrow-repay';
    const timestamp = Date.now();

    const params = `asset=${asset}&symbol=${symbol}&isIsolated=TRUE&type=${type}&amount=${amount}&timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(params).digest('hex');
    const url = `${base}${path}?${params}&signature=${signature}`;

    console.log(`rawBorrowRepay => ${type} ${amount} ${asset} on ${symbol}`);

    try {
        const resp = await axios.post(url, null, {
            headers: {
                'X-MBX-APIKEY': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('rawBorrowRepay success =>', resp.data);
        return resp.data;
    } catch (err) {
        const data = err?.response?.data;
        console.error('rawBorrowRepay error:', JSON.stringify(data));
        const error = new Error(data?.msg || err?.message);
        error.code = data?.code;
        throw error;
    }
}

module.exports = { rawBorrowRepay };
