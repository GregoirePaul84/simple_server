function getSlAndTpLevels(type) {

    let sl;
    let tp;

    switch (type) {
        case 'BTC_LONG':
            sl = 5.38;
            tp = 8.59;
            break;

        case 'BTC_SHORT':
            sl = 5.11;
            tp = 8.94;
        
        case 'DOGE_PUMP':
            sl = 1.0;
            tp = 3.1;
            break;
        
        case 'DOGE_RANGE':
            sl = 1.2;
            tp = 2.2;
            break;

        case 'DOGE_OVERSOLD':
            sl = 1.6;
            tp = 2.3;
            break;

        case 'DOGE_SHORT':
            sl = 1.5;
            tp = 2.57;

        default:
            throw new Error(`Type d'achat non reconnu : ${type}`);
    }

    return { stop_loss: sl, take_profit: tp }
}

module.exports = { getSlAndTpLevels };
