const { getOkxClient } = require('./okxClient');

const MIN_NOTIONAL_USD = 10;

async function getPositionStatus(symbol) {
    const okxClient = getOkxClient();
    const res = await okxClient.getPositions({ instType: 'SWAP', instId: symbol });

    if (!res.data || res.data.length === 0) {
        return { hasOpenPosition: false, hasLong: false, hasShort: false, longNotional: 0, shortNotional: 0 };
    }

    const pos = res.data[0];
    const contracts = parseFloat(pos.pos || 0);
    const notionalUsd = Math.abs(parseFloat(pos.notionalUsd || 0));

    const hasLong  = contracts > 0 && notionalUsd > MIN_NOTIONAL_USD;
    const hasShort = contracts < 0 && notionalUsd > MIN_NOTIONAL_USD;

    return {
        hasOpenPosition: hasLong || hasShort,
        hasLong,
        hasShort,
        longNotional:  hasLong  ? notionalUsd : 0,
        shortNotional: hasShort ? notionalUsd : 0,
    };
}

module.exports = { getPositionStatus };
