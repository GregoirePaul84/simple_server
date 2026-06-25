const { getOkxClient } = require('./okxClient');

const getBalanceData = async (symbol) => {
    console.log(`Récup de la balance pour ${symbol}`);

    const okxClient = getOkxClient();
    const res = await okxClient.getAccountBalance({ ccy: 'USDC' });

    if (!res.data || res.data.length === 0) {
        throw new Error('Impossible de récupérer la balance OKX.');
    }

    const detail = res.data[0].details?.find(d => d.ccy === 'USDC');
    const availBal = detail ? parseFloat(detail.availBal) : 0;

    // On retourne le même shape qu'avant pour ne pas casser les appelants.
    // baseAsset.free = 0 : les perpétuels ne détiennent pas l'actif physique.
    return {
        quoteAsset: { free: availBal },
        baseAsset: { free: 0 },
    };
};

module.exports = { getBalanceData };
