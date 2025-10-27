const axios = require('axios');
const crypto = require('crypto');

async function isolatedMarginLoanRaw({ asset, amount, symbol, apiKey, apiSecret }) {
  console.log('Début de l\'emprunt...');
  
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
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('la réponse lors de l\'emprunt =>', resp);
    
    return resp.data;
  } catch (err) {
    const data = err?.response?.data;
    const status = err?.response?.status;
    const msg = err?.message;
    console.error('Erreur HTTP status:', status);
    console.error('Erreur payload:', data);
    console.error('Erreur message:', msg);
    console.error("Erreur Binance complète :", JSON.stringify(err?.response?.data, null, 2));
    throw data || { code: 'UNKNOWN', msg: msg || 'Unknown error' };
  }
}

module.exports = { isolatedMarginLoanRaw };