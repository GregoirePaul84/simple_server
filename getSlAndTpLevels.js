function getSlAndTpLevels(type) {
  let sl;
  let tp;

  console.log("le type =>", type);

  switch (type) {
    case "BTC_LONG":
      sl = 6.15;
      tp = 8.59;
      break;

    case "BTC_SHORT":
      sl = 5.24;
      tp = 8.94;
      break;

    // DOGE 30min
    case "DOGE_LONG_CORRIDOR":
      sl = 3.7;
      tp = 7.0;
      break;

    case "DOGE_LONG_SMALL_CORRIDOR":
      sl = 2.9;
      tp = 3.7;
      break;

    case "DOGE_PUMP_30":
      sl = 4.0;
      tp = 5.0;
      break;

    case "DOGE_SMALL_PUMP_30":
      sl = 3.4;
      tp = 4.5;
      break;

    case "DOGE_LONG_NARROW":
      sl = 3.2;
      tp = 4.5;
      break;

    case "DOGE_SHORT_PANIC":
      sl = 3.5;
      tp = 7.0;
      break;

    case "DOGE_SHORT_NARROW":
      sl = 3.4;
      tp = 4.3;
      break;

    case "DOGE_SHORT_CROSSUNDER_ZONE_HIGH":
      sl = 4.3;
      tp = 8.0;
      break;

    case "DOGE_SHORT_SMALL_ZONE":
      sl = 3.5;
      tp = 4.5;
      break;

    case "DOGE_SHORT_DEAD_ZONE":
      sl = 2.0;
      tp = 4.2;
      break;

    case "DOGE_LONG_CROSSOVER":
      sl = 4.2;
      tp = 5.2;
      break;

    case "DOGE_LONG_REBOUND":
      sl = 5.0;
      tp = 5.0;
      break;

    case "DOGE_LONG_TAKE_OFF":
      sl = 4.8;
      tp = 5.4;
      break;

    case "DOGE_SHORT_CROSSUNDER":
      sl = 3.8;
      tp = 4.8;
      break;

    case "DOGE_SHORT_DUMP":
      sl = 3.0;
      tp = 4.4;
      break;

    case "DOGE_SHORT_CROSSUNDER_SMA":
      sl = 2.5;
      tp = 5.4;
      break;

    case "DOGE_SHORT_CONTINUED":
      sl = 4.7;
      tp = 5.7;
      break;

    case "DOGE_SHORT_RARE_PANIC":
      sl = 3.0;
      tp = 15.0;
      break;

    default:
      throw new Error(`Type d'achat non reconnu : ${type}`);
  }

  let sl_buffer = 0.1; // Pour les problèmes de sync / slippage avec tradingview
  sl += sl_buffer;

  return { stop_loss: sl, take_profit: tp };
}

module.exports = { getSlAndTpLevels };
