const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { getOkxClient } = require("../okxClient");

// Sur OKX perpétuels, les shorts sont natifs : aucun emprunt/remboursement requis.
const takeShortPosition = async (symbol, type, price, usdcBalance, bot, chatId) => {
    console.log('⬇️ Début de la position short...');

    if (usdcBalance <= 0) {
        throw new Error('Solde USDC insuffisant.');
    }

    const okxClient = getOkxClient();

    // Specs de l'instrument
    const instrRes = await okxClient.getInstruments({ instType: 'FUTURES', instId: symbol });
    const inst = instrRes.data[0];
    const ctVal = parseFloat(inst.ctVal);
    const lotSz = parseFloat(inst.lotSz);

    const feeRate = 0.001;
    const baseQty = (usdcBalance / price) * (1 - feeRate);

    let contractQty = Math.floor(baseQty / ctVal);
    contractQty = Math.floor(contractQty / lotSz) * lotSz;

    if (contractQty < lotSz) {
        throw new Error(`Quantité trop faible : ${contractQty} contrat(s). Minimum : ${lotSz}`);
    }

    console.log(`🔢 Quantité à shorter : ${contractQty} contrat(s)`);

    // Ordre MARKET short en mode isolated
    const orderRes = await okxClient.submitOrder({
        instId:  symbol,
        tdMode:  'isolated',
        side:    'sell',
        ordType: 'market',
        sz:      String(contractQty),
    });

    if (orderRes.data?.[0]?.sCode !== '0') {
        throw new Error(`Erreur placeOrder OKX short : ${orderRes.data?.[0]?.sMsg || JSON.stringify(orderRes)}`);
    }

    const orderId = orderRes.data[0].ordId;
    console.log('📈 Short ouvert, orderId :', orderId);

    // Récupère le prix d'exécution moyen
    const detailRes = await okxClient.getOrderDetails({ instId: symbol, ordId: orderId });
    const entry = parseFloat(detailRes.data?.[0]?.avgPx) || price;
    console.log(`Prix d'entrée short : ${entry}`);

    const slTp = getSlAndTpLevels(type);
    const sl   = entry * (1 + slTp.stop_loss   / 100);
    const tp   = entry * (1 - slTp.take_profit / 100);

    const quantityBase  = contractQty * ctVal;
    const pnlPotential  = (entry - tp) * quantityBase;
    const lossPotential = (sl - entry)  * quantityBase;

    bot.sendMessage(
        chatId,
        `📉 Short exécuté sur ${symbol}\n\n` +
        `• Prix : ${entry} USDC\n` +
        `• Quantité : ${contractQty} contrat(s) (${quantityBase.toFixed(6)} ${symbol.split('-')[0]})\n` +
        `• Gain potentiel : +${pnlPotential.toFixed(2)} USDC\n` +
        `• Perte potentielle : -${lossPotential.toFixed(2)} USDC\n`
    );

    return {
        order: { executedQty: String(quantityBase) },
        initialPrice: entry,
        contractQty,
        ctVal,
    };
};

module.exports = { takeShortPosition };
