const axios = require('axios');

// Générer un listenKey pour le portefeuille Margin isolé
const getIsolatedMarginListenKey = async (symbol) => {
    try {
        const response = await axios.post(
            `https://api.binance.com/sapi/v3/userDataStream/isolated?symbol=${symbol}`,
            null,
            { headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY } }
        );

        if (!response.data || !response.data.listenKey) {
            throw new Error('Aucune listenKey reçue pour le portefeuille Margin isolé.');
        }

        console.log(`ListenKey générée pour le portefeuille Margin isolé (${symbol}) :`, response.data.listenKey);
        return response.data.listenKey;
    } catch (error) {
        console.error('Erreur lors de la génération du listenKey Margin isolé :', error.message);
        throw error;
    }
};

// Renouveller le listen key
const keepAliveMarginListenKey = async (listenKey, symbol) => {
  try {
    console.log(`Renouvellement listenKey ${symbol}: ${listenKey}`);

    await axios.put(
      `https://api.binance.com/sapi/v3/userDataStream/isolated`,
      null,
      {
        headers: { 'X-MBX-APIKEY': process.env.BINANCE_MARGIN_API_KEY },
        params: { listenKey, symbol }
      }
    );

    console.log(`✅ ListenKey renouvelée avec succès pour ${symbol}`);
    return false; // pas besoin de reconnect
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data || error.message;
    console.error(`❌ KeepAlive listenKey ${symbol}:`, msg);

    // ✅ Erreurs réseau intermittentes : on ne reconnect pas forcément
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.code === 'ETIMEDOUT') {
      console.warn(`🌐 Problème réseau/DNS temporaire pour ${symbol}, on retentera au prochain tick.`);
      return false;
    }

    // ✅ 400 = listenKey invalide/expirée => on demande une reconnexion
    if (status === 400) {
      console.warn(`🔑 ListenKey expirée/invalide pour ${symbol} => reconnexion nécessaire.`);
      return true;
    }

    // Autres 
    return false;
  }
};


module.exports = { getIsolatedMarginListenKey, keepAliveMarginListenKey };
