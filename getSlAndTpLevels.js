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
            break;
        
        case 'DOGE_PUMP':
            sl = 1.4;
            tp = 3.1;
            break;
        
        case 'DOGE_RANGE':
            sl = 1.3;
            tp = 2.7;
            break;

        case 'DOGE_OVERSOLD':
            sl = 1.6;
            tp = 3.3;
            break;

        case 'DOGE_SHORT_RANGE':
            sl = 1.5;
            tp = 2.57;
            break;

        case 'DOGE_SHORT_DUMP':
            sl = 1.5;
            tp = 2.8;
            break;

        // DOGE 30min 
        case 'DOGE_LONG_CORRIDOR':
            sl = 3.7;
            tp = 7.0;
            break;

        case 'DOGE_LONG_SMALL_CORRIDOR':
            sl = 2.9;
            tp = 4.8;
            break;

        case 'DOGE_PUMP_30':
            sl = 4.0;
            tp = 5.9;
            break;

        case 'DOGE_SMALL_PUMP_30':
            sl = 3.8;
            tp = 6.1;
            break;

        case 'DOGE_LONG_NARROW':
            sl = 3.2;
            tp = 4.0;
            break;

        case 'DOGE_SHORT_PANIC':
            sl = 2.0;
            tp = 6.8;
            break;

        case 'DOGE_SHORT_NARROW':
            sl = 2.7;
            tp = 4.4;
            break;

        case 'DOGE_SHORT_CROSSUNDER_ZONE_HIGH':
            sl = 4.3;
            tp = 7.0;
            break;

        case 'DOGE_SHORT_SMALL_ZONE':
            sl = 3.5;
            tp = 5.8;
            break;

        default:
            throw new Error(`Type d'achat non reconnu : ${type}`);
    }

    return { stop_loss: sl, take_profit: tp }
}

module.exports = { getSlAndTpLevels };
