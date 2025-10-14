const axios = require('axios');
const crypto = require('crypto');

async function isolatedMarginLoanRaw({ asset, amount, symbol, apiKey, apiSecret }) {
  const baseUrl = 'https://api.binance.com';
  const path = '/sapi/v1/margin/loan';
  const timestamp = Date.now();
  const params = `asset=${asset}&amount=${amount}&isIsolated=TRUE&symbol=${symbol}&timestamp=${timestamp}`;
  
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(params)
    .digest('hex');

  const url = `${baseUrl}${path}?${params}&signature=${signature}`;

  try {
    const resp = await axios.post(url, null, {
      headers: {
        'X-MBX-APIKEY': apiKey
      }
    });
    return resp.data;
  } catch (err) {
    // err.response.data probable
    throw err.response ? err.response.data : err;
  }
}

module.exports = { isolatedMarginLoanRaw };