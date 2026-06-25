const { RestClient } = require('okx-api');

let _client = null;

function getOkxClient() {
    if (!_client) {
        _client = new RestClient({
            apiKey: process.env.OKX_API_KEY,
            apiSecret: process.env.OKX_API_SECRET,
            apiPass: process.env.OKX_PASSPHRASE,
        });
    }
    return _client;
}

module.exports = { getOkxClient };
