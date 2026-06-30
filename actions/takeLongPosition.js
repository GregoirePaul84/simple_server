const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { getOkxClient } = require("../okxClient");

const takeLongPosition = async (symbol, type, price, usdcBalance, bot, chatId) => {
    console.log(`Achat commencé pour ${symbol}`);

    if (usdcBalance <= 0) {
        throw new Error('Solde USDC insuffisant.');
    }

    console.log(`Balance disponible => ${usdcBalance} USDC`);

    const okxClient = getOkxClient();

    // Specs de l'instrument (taille de contrat, lot minimum, tick de prix)
    const instrRes = await okxClient.getInstruments({ instType: 'FUTURES', instId: symbol });
    const inst = instrRes[0];
    const ctVal  = parseFloat(inst.ctVal);   // ex: 0.01 BTC par contrat
    const lotSz  = parseFloat(inst.lotSz);   // lot minimum en contrats (ex: 1)

    // Quantité brute en actif de base, ajustée pour slippage + frais
    const slippage = 0.01;
    const feeRate  = 0.00075;
    const baseQty  = (usdcBalance / price) * (1 - feeRate - slippage);

    // Conversion en contrats, arrondi au lot minimum
    let contractQty = Math.floor(baseQty / ctVal);
    contractQty = Math.floor(contractQty / lotSz) * lotSz;

    if (contractQty < lotSz) {
        throw new Error(`Quantité trop faible. Minimum requis pour ${symbol} : ${lotSz} contrat(s)`);
    }

    const totalOrderValue = contractQty * ctVal * price;
    console.log(`Quantité : ${contractQty} contrat(s) (~${totalOrderValue.toFixed(2)} USDC)`);

    // Ordre MARKET long en mode isolated, levier x1
    const orderRes = await okxClient.submitOrder({
        instId:  symbol,
        tdMode:  'cross',
        side:    'buy',
        ordType: 'market',
        sz:      String(contractQty),
    });

    if (orderRes?.[0]?.sCode !== '0') {
        throw new Error(`Erreur placeOrder OKX : ${orderRes?.[0]?.sMsg || JSON.stringify(orderRes)}`);
    }

    const orderId = orderRes[0].ordId;
    console.log('Prise de position longue, orderId :', orderId);

    // Récupère le prix d'exécution moyen
    const detailRes = await okxClient.getOrderDetails({ instId: symbol, ordId: orderId });
    const initialPrice = parseFloat(detailRes?.[0]?.avgPx) || price;
    console.log(`Prix d'entrée enregistré : ${initialPrice}`);

    const slAndTpLevels = getSlAndTpLevels(type);
    const stopLoss   = initialPrice * (1 - slAndTpLevels.stop_loss   / 100);
    const takeProfit = initialPrice * (1 + slAndTpLevels.take_profit / 100);

    const quantityBase  = contractQty * ctVal;
    const potentialGain = (takeProfit - initialPrice) * quantityBase;
    const potentialLoss = (initialPrice - stopLoss)   * quantityBase;

    const baseSymbol = symbol.split('-')[0]; // 'BTC' ou 'DOGE'

    bot.sendMessage(
        chatId,
        `✅ Ordre d'achat exécuté :\n` +
        `        - Symbole : ${symbol}\n` +
        `        - Prix d'achat: ${initialPrice} USDC\n` +
        `        - Capital investi : ${usdcBalance.toFixed(2)} USDC\n` +
        `        - Quantité achetée : ${contractQty} contrat(s) (${quantityBase.toFixed(6)} ${baseSymbol})\n` +
        `        - Gain potentiel : +${potentialGain.toFixed(2)} USDC\n` +
        `        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC\n`
    );

    // Retourne le shape attendu par server.js
    return {
        order: { executedQty: String(contractQty * ctVal) },
        initialPrice,
        contractQty,
        ctVal,
    };
};

module.exports = { takeLongPosition };
