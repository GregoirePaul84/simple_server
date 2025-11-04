const { getBalanceData } = require("./getBalanceData");

const getDebtForSymbol = async(symbol) => {
    const balanceData = await getBalanceData(symbol);

    const borrowed = parseFloat(balanceData.baseAsset.borrowed);
    const interest = parseFloat(balanceData.baseAsset.interest);
    const totalDebt = borrowed + interest;

    return {
        borrowed,
        interest,
        totalDebt
    };
};


const repayDebtForSymbol = async(symbol, binanceMargin) => {
    const asset = symbol.replace('USDC', '');
    const { totalDebt } = await getDebtForSymbol(symbol);

    if (totalDebt > 0.00000001) {
        await binanceMargin.marginRepay({
            asset,
            symbol,
            isIsolated: 'TRUE',
            amount: totalDebt.toFixed(8),
            type: 'REPAY'
        });

        console.log(`✅ Remboursement total de ${totalDebt.toFixed(8)} ${asset} sur ${symbol}`);
        return true;
    } else {
        console.log(`✅ Pas de dette restante sur ${symbol}`);
        return false;
    }
};

module.exports = { repayDebtForSymbol }