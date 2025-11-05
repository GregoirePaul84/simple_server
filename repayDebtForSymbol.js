const { getBalanceData } = require("./getBalanceData");

const repayDebtForSymbol = async (symbol, binanceMargin) => {
    const asset = symbol.replace('USDC', '');
    const balanceData = await getBalanceData(symbol);

    const free = parseFloat(balanceData.baseAsset.free);
    const borrowed = parseFloat(balanceData.baseAsset.borrowed);
    const interest = parseFloat(balanceData.baseAsset.interest);
    const totalDebt = borrowed + interest;

    console.log(`💰 free=${free} borrowed=${borrowed} interest=${interest} totalDebt=${totalDebt}`);

    if (totalDebt > 0.00000001) {
        const repayAmount = Math.min(free, totalDebt);

        if (repayAmount <= 0) {
            console.warn(`⚠️ Aucun asset disponible pour repay sur ${symbol}`);
            return false;
        }

        await binanceMargin.marginRepay({
            asset,
            symbol,
            isIsolated: 'TRUE',
            amount: repayAmount.toFixed(8),
            type: 'REPAY'
        });

        console.log(`✅ Repay effectué : ${repayAmount.toFixed(8)} ${asset}`);
        return true;
    }

    console.log(`✅ Pas de dette à rembourser sur ${symbol}`);
    return false;
};


module.exports = { repayDebtForSymbol }