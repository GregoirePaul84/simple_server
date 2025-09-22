const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");

const takeShortPosition = async (
    binance,
    symbol,
    type,
    price,
    usdcBalance,
    bot,
    chatId
) => {
    if (usdcBalance <= 0) {
        console.error('Solde insuffisant en USDC pour vendre à découvert.');
        throw new Error('Solde insuffisant en USDC pour vendre à découvert.');
    }

    // 🔹 Récupération dynamique des règles de lot
    const exchangeInfo = await binance.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    const minQty = parseFloat(lotSizeFilter.minQty);
    const decimalPlaces = getDecimalPlaces(stepSize);

    // 🔹 Calcul de l'actif à vendre
    const feeRate = 0.00075;
    const marginForFees = 1 - feeRate;
    let quantityToSell = (usdcBalance / price) * marginForFees * 0.7;
    quantityToSell = Math.floor(quantityToSell / stepSize) * stepSize;
    quantityToSell = parseFloat(quantityToSell.toFixed(decimalPlaces));

    if (quantityToSell < minQty) {
        throw new Error(`La quantité calculée (${quantityToSell}) est inférieure au minimum requis (${minQty}).`);
    }

    const totalOrderValue = quantityToSell * price;
    if (totalOrderValue < 5) {
        throw new Error(`Le montant total de l'ordre (${totalOrderValue.toFixed(2)} USDC) est inférieur au minimum requis de 5 USDC.`);
    }

    // 🔹 Déduction automatique de l'actif à emprunter (ex: DOGE)
    const loanAsset = symbol.replace('USDC', '');

    // 🔹 Étape 1 : Emprunt
    try {
        console.log(`Demande d'emprunt de ${quantityToSell} ${loanAsset}.`);
        const loanResponse = await binance.marginLoan({
            asset: loanAsset,
            amount: quantityToSell,
            isIsolated: true,
            symbol,
        });
        console.log(`Emprunt de ${quantityToSell} ${loanAsset} effectué.`, loanResponse);
    } catch (error) {
        console.error('Erreur lors de l\'emprunt :', error.message);
        throw error;
    }

    // 🔹 Étape 2 : Vente à découvert
    let order;
    try {
        console.log('Passage de l\'ordre de vente.');
        order = await binance.marginOrder({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: quantityToSell,
            isIsolated: true,
        });
        console.log('Ordre de vente à découvert effectué.', order);
    } catch (error) {
        console.error('Erreur lors de l\'ordre de vente à découvert :', error.message);
        // ⚠️ Rembourse l'emprunt si l'ordre échoue
        await binance.marginRepay({
            asset: loanAsset,
            amount: quantityToSell,
            isIsolated: true,
            symbol,
        });
        console.log(`${loanAsset} remboursé après échec de la vente.`);
        throw error;
    }

    // 🔹 Étape 3 : SL / TP
    const slAndTpLevels = getSlAndTpLevels(type);
    const stopLoss = price * (1 + slAndTpLevels.stop_loss / 100);
    const takeProfit = price * (1 - slAndTpLevels.take_profit / 100);
    const potentialGain = (price - takeProfit) * quantityToSell;
    const potentialLoss = (stopLoss - price) * quantityToSell;

    const initialPrice = parseFloat(order.fills[0]?.price) || price;

    // 🔹 Telegram
    bot.sendMessage(
        chatId,
        `✅ Ordre de vente à découvert exécuté :
        - Symbole : ${symbol}
        - Prix de vente : ${price} USDC
        - Capital investi : ${usdcBalance.toFixed(2)} USDC
        - Quantité vendue : ${quantityToSell}
        - Gain potentiel : +${potentialGain.toFixed(2)} USDC
        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC`
    );

    return { order, initialPrice };
};

module.exports = { takeShortPosition };
