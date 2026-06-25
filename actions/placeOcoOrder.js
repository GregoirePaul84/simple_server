const { getDecimalPlaces } = require("../getDecimalPlaces");
const { getSlAndTpLevels } = require("../getSlAndTpLevels");
const { getOkxClient } = require("../okxClient");

// side param : 'BUY' (on vient d'ouvrir un long) ou 'SELL' (on vient d'ouvrir un short)
const placeOCOOrder = async (symbol, type, side, price, assetsAvailable, bot, chatId) => {
    try {
        console.log(`ordre OCO débuté pour ${symbol}`);

        if (assetsAvailable <= 0) {
            throw new Error('Quantité insuffisante pour passer un ordre OCO.');
        }

        const okxClient = getOkxClient();

        // Specs de l'instrument
        const instrRes = await okxClient.getInstruments({ instType: 'SWAP', instId: symbol });
        const inst = instrRes.data[0];
        const ctVal  = parseFloat(inst.ctVal);
        const lotSz  = parseFloat(inst.lotSz);
        const tickSz = parseFloat(inst.tickSz);
        const priceDecimalPlaces = getDecimalPlaces(tickSz);

        const slAndTpLevels = getSlAndTpLevels(type);

        // Calcul des prix TP / SL (logique identique à l'original)
        const takeProfitPrice = side === 'BUY'
            ? price * (1 + slAndTpLevels.take_profit / 100)
            : price * (1 - slAndTpLevels.take_profit / 100);

        const stopLossPrice = side === 'BUY'
            ? price * (1 - slAndTpLevels.stop_loss / 100)
            : price * (1 + slAndTpLevels.stop_loss / 100);

        console.log('Take Profit Price :', takeProfitPrice.toFixed(priceDecimalPlaces));
        console.log('Stop Loss Price   :', stopLossPrice.toFixed(priceDecimalPlaces));

        // assetsAvailable est en base asset (BTC/DOGE) → conversion en contrats
        let finalContracts = Math.floor(assetsAvailable / ctVal);
        finalContracts = Math.floor(finalContracts / lotSz) * lotSz;

        if (finalContracts < lotSz) {
            throw new Error(`Quantité trop faible pour ${symbol}. Minimum requis : ${lotSz} contrat(s)`);
        }

        console.log('Quantité finale (contrats) =>', finalContracts);

        // Côté de clôture : inverse du côté d'ouverture
        const closeSide = side === 'BUY' ? 'sell' : 'buy';

        // Algo ordre OCO OKX — clôture uniquement (reduceOnly)
        const algoRes = await okxClient.placeAlgoOrder({
            instId:       symbol,
            tdMode:       'isolated',
            side:         closeSide,
            ordType:      'oco',
            sz:           String(finalContracts),
            tpTriggerPx:  takeProfitPrice.toFixed(priceDecimalPlaces),
            tpOrdPx:      '-1',     // exécution market au déclenchement TP
            slTriggerPx:  stopLossPrice.toFixed(priceDecimalPlaces),
            slOrdPx:      '-1',     // exécution market au déclenchement SL
            reduceOnly:   'true',
        });

        if (algoRes.data?.[0]?.sCode !== '0') {
            throw new Error(`Erreur placeAlgoOrder OKX : ${algoRes.data?.[0]?.sMsg || JSON.stringify(algoRes)}`);
        }

        console.log('Ordre OCO OKX passé avec succès :', algoRes.data[0]);

        bot.sendMessage(
            chatId,
            `✅ Ordre OCO ajusté :\n` +
            `            - Take profit : ${takeProfitPrice.toFixed(priceDecimalPlaces)} USDC\n` +
            `            - Stop loss : ${stopLossPrice.toFixed(priceDecimalPlaces)} USDC\n`
        );
    } catch (error) {
        console.error('Erreur lors du passage de l\'ordre OCO :', error.message);
        throw error;
    }
};

module.exports = { placeOCOOrder };
