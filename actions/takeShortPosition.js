require('dotenv').config();
const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { isolatedMarginLoanRaw } = require('../isolatedMarginLoanRaw');

const takeShortPosition = async (
    binance,
    symbol,
    type,
    price,
    usdcBalance,
    bot,
    chatId
) => {
    console.log('début du short...');
    
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

    // 🔹 Calcul de la quantité à vendre
    const feeRate = 0.001;
    const marginForFees = 1 - feeRate;
    let quantityToSell = (usdcBalance / price) * marginForFees;
    quantityToSell = Math.floor(quantityToSell / stepSize) * stepSize;
    quantityToSell = parseFloat(quantityToSell.toFixed(decimalPlaces));

    // Vérifications de base
    if (quantityToSell < minQty) throw new Error(`Quantité trop faible (${quantityToSell})`);
    if (quantityToSell * price < 5) throw new Error(`Valeur < 5 USDC.`);

    // 🔹 Déduction automatique de l'actif à emprunter (ex: DOGE)
    const loanAsset = symbol.replace('USDC', '');

    try {
        console.log('loanAsset =>', loanAsset);

        const maxBorrow = await binance.marginMaxBorrow({ asset: loanAsset, isolatedSymbol: symbol, isIsolated: 'TRUE' })
        const maxAmount = parseFloat(maxBorrow.amount);
        if (maxAmount <= 0) throw new Error(`Aucun montant empruntable pour ${loanAsset}.`);

        console.log('quantité à vendre =>', quantityToSell, 'max empruntable =>', maxAmount);

        quantityToSell = Math.min(quantityToSell, maxAmount);

        console.log({
            usdcBalance,
            price,
            quantityToSell,
            maxAmount
        });

    } catch (error) {
        console.error('Erreur lors du calcul de l\'emprunt :', error.message);
        throw error;
    }
    
    // 🔹 Étape 1 : Emprunt
    try {

        console.log(`🔹 début de l'emprunt pour ${loanAsset}...`);

        console.log({
            asset: loanAsset,
            amount: quantityToSell.toString(),
            symbol,
        });

        const response = await isolatedMarginLoanRaw({
            asset: loanAsset,
            amount: quantityToSell.toString(),
            symbol: `${symbol}`,
            apiKey: process.env.BINANCE_MARGIN_API_KEY,
            apiSecret: process.env.BINANCE_MARGIN_API_SECRET
        });

        console.log('la réponse =>', response);

        console.log(`Emprunt de ${quantityToSell} ${loanAsset} effectué.`);
        
    } catch (error) {        
        const msg = error.response?.data?.msg || error.message;
        const code = error.response?.data?.code;
        console.error('Erreur lors de l\'emprunt :', msg);
        console.error('le code erreur =>', code);
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
            isIsolated: 'TRUE',
        });

        console.log('Ordre de vente à découvert effectué.', order);

    } catch (error) {

        console.error('Erreur lors de l\'ordre de vente à découvert :', error.message);

        // ⚠️ Rembourse l'emprunt si l'ordre échoue
        await binance.marginRepay({
            asset: loanAsset,
            amount: quantityToSell,
            isIsolated: 'TRUE',
            symbol,
        });

        console.log(`${loanAsset} remboursé après échec de la vente.`);

        throw error;
    }

    // 🔹 Étape 3 : SL / TP
    const slAndTpLevels = getSlAndTpLevels(type);
    const initialPrice = parseFloat(order.fills[0]?.price) || price;
    const stopLoss = initialPrice * (1 + slAndTpLevels.stop_loss / 100);
    const takeProfit = initialPrice * (1 - slAndTpLevels.take_profit / 100);

    const potentialGain = (initialPrice - takeProfit) * quantityToSell;
    const potentialLoss = (stopLoss - initialPrice) * quantityToSell;

    // 🔹 Telegram
    bot.sendMessage(
        chatId,
        `✅ Ordre de vente à découvert exécuté :
        - Symbole : ${symbol}
        - Prix de vente : ${initialPrice} USDC
        - Capital investi : ${usdcBalance.toFixed(2)} USDC
        - Quantité vendue : ${quantityToSell}
        - Gain potentiel : +${potentialGain.toFixed(2)} USDC
        - Perte potentielle : -${potentialLoss.toFixed(2)} USDC`
    );

    return { order, initialPrice };
};

module.exports = { takeShortPosition };
