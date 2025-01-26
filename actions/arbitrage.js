let usdtBalance = 0; // Variable globale pour stocker la balance USDT
let lastArbitrageTime = 0; // Timestamp du dernier arbitrage exécuté
const cooldownTime = 10 * 1000; // Cooldown de 10 secondes (en millisecondes)

const updateUsdtBalance = async (binance) => {
    try {
        const accountInfo = await binance.accountInfo();
        const usdtAsset = accountInfo.balances.find((asset) => asset.asset === 'USDT');
        usdtBalance = parseFloat(usdtAsset.free);
        console.log(`Solde USDT mis à jour : ${usdtBalance.toFixed(2)} USDT`);
    } catch (error) {
        console.error('Erreur lors de la récupération de la balance USDT :', error.message);
    }
};

const checkArbitrageOpportunity = async (binance, bot, chatId) => {
    try {
        
        const currentTime = Date.now();

        // Vérifier si le cooldown est terminé
        if (currentTime - lastArbitrageTime < cooldownTime) {
            // console.log(`En cooldown. Temps restant : ${(cooldownTime - (currentTime - lastArbitrageTime)) / 1000}s`);
            return;
        }

        // Récupérer les prix actuels des paires
        const tickers = await binance.prices();

        // Prix nécessaires
        const btcUsdtPrice = parseFloat(tickers['BTCUSDT']); // Acheter BTC avec USDT
        const ethBtcPrice = parseFloat(tickers['ETHBTC']);   // Acheter ETH avec BTC
        const ethUsdtPrice = parseFloat(tickers['ETHUSDT']); // Vendre ETH pour USDT
        
        // Montant initial en USDT
        const initialUsdt = usdtBalance; // Capital en USDT sur le portefeuille spot
        const feeRate = 0.00075; // 0.075% frais Binance avec réduction via BNB
        const totalFeesRate = feeRate * 3; // Total des frais pour les 3 transactions (0.225%)

        // Calcul des étapes du cycle
        const btcAmount = initialUsdt / btcUsdtPrice * (1 - feeRate); // Étape 1 : USDT → BTC
        const ethAmount = btcAmount / ethBtcPrice * (1 - feeRate);    // Étape 2 : BTC → ETH
        const finalUsdt = ethAmount * ethUsdtPrice * (1 - feeRate);   // Étape 3 : ETH → USDT

        // Calcul du profit brut
        const profit = finalUsdt - initialUsdt;

        // Marge de profit minimale en pourcentage
        const minimumProfitPercentage = 0.2; // Marge de 0.2% nette après frais
        const minimumProfitNet = (initialUsdt * (minimumProfitPercentage + totalFeesRate * 100)) / 100;

        // console.log(`Montant final : ${finalUsdt.toFixed(2)} USDT`);
        // console.log(`Profit brut potentiel : ${profit.toFixed(2)} USDT`);
        // console.log(`Profit minimum requis après frais : ${minimumProfitNet.toFixed(2)} USDT`);

        // Vérification du profit net
        if (profit > minimumProfitNet) {
            console.log('🚀 Opportunité d\'arbitrage détectée ! Exécution du cycle.');

            // Exécuter le cycle d'arbitrage
            await executeArbitrageCycle(initialUsdt, btcUsdtPrice, ethBtcPrice, ethUsdtPrice, feeRate, bot, chatId);

            // Mettre à jour le timestamp du dernier arbitrage
            lastArbitrageTime = Date.now();
        } else {
            console.log('Aucune opportunité détectée pour le moment.');
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des opportunités d\'arbitrage :', error.message);
        bot.sendMessage(chatId, `❌ Erreur lors de la vérification des opportunités : ${error.message}`);
    }
};

const executeArbitrageCycle = async (initialUsdt, btcUsdtPrice, ethBtcPrice, ethUsdtPrice, feeRate, bot, chatId) => {
    try {
        if(usdtBalance < 10) {
            console.log('Solde USDT insuffisant pour effectuer un arbitrage.');

            // Envoi d'une notification via Telegram
            bot.sendMessage(
                chatId,
                `❌ Solde USDT insuffisant pour effectuer un arbitrage.`
            );
        }

        console.log('Début de l\'exécution du cycle d\'arbitrage...');

        // Étape 1 : Acheter BTC avec USDT
        const btcAmount = initialUsdt / btcUsdtPrice * (1 - feeRate);
        console.log(`Achat BTC : ${btcAmount.toFixed(8)} BTC avec ${initialUsdt} USDT.`);

        // Étape 2 : Acheter ETH avec BTC
        const ethAmount = btcAmount / ethBtcPrice * (1 - feeRate);
        console.log(`Achat ETH : ${ethAmount.toFixed(8)} ETH avec ${btcAmount.toFixed(8)} BTC.`);

        // Étape 3 : Vendre ETH pour USDT
        const finalUsdt = ethAmount * ethUsdtPrice * (1 - feeRate);
        console.log(`Vente ETH : ${ethAmount.toFixed(8)} ETH pour ${finalUsdt.toFixed(2)} USDT.`);

        console.log('Cycle d\'arbitrage exécuté avec succès.');

        // Calcul des gains
        const profit = finalUsdt - initialUsdt;

        // Envoi d'une notification via Telegram
        bot.sendMessage(
            chatId,
            `🚀 Arbitrage !
            - Montant initial : ${initialUsdt.toFixed(2)} USDT
            - Montant récupéré : ${finalUsdt.toFixed(2)} USDT
            - Gains réalisés : ${profit.toFixed(2)} USDT
            `
        );
    } catch (error) {
        console.error('Erreur lors de l\'exécution du cycle d\'arbitrage :', error.message);
        bot.sendMessage(chatId, `❌ Erreur lors de l'exécution du cycle : ${error.message}`);
    }
};

module.exports = { updateUsdtBalance, checkArbitrageOpportunity };
