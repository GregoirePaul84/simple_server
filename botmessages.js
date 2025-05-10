const getLossMessage = () => {
    const messages = [
        "La rivière perce le rocher non par sa force, mais par sa persévérance. 💦",
        "Chaque perte est une leçon, et chaque leçon te rapproche du succès. 📚",
        "Nana korobi ya oki. (Tombe sept fois, relève-toi huit.) 🥋",
        "Le succès n'est pas l'absence d'échec, mais la capacité à se relever après chaque chute. 🧗",
        "La patience est un arbre dont les racines sont amères, mais les fruits sont doux. 🍃",
        "Rien ne se perd, tout s’apprend. 🌱",
        "L'échec est simplement l'opportunité de recommencer, cette fois plus intelligemment. 🧠",
        "Même les plus grandes montagnes se gravissent un pas à la fois. 🏔️",
        "C'est dans la tempête que le marin apprend à naviguer. ⛵",
        "Un pas en arrière n’est pas un échec, c’est l’élan pour mieux sauter. 🦘",
        "Les racines poussent dans l’obscurité avant de voir la lumière. 🌱",
        "Ce n'est pas la fin, c'est juste un détour vers un meilleur chemin. 🔁",
        "L’art de gagner commence par l’acceptation de perdre. 🎭",
        "Même un jour rouge n’efface pas une vision verte. 🟢",
        "Les pertes d’aujourd’hui sont les fondations des victoires de demain. 🏗️",
        "Tu n'as pas échoué tant que tu n'as pas abandonné. 🔁",
        "Chaque cicatrice est la preuve que tu avances. ⚔️",
        "Les meilleurs traders sont forgés dans la douleur, pas dans la facilité. 🔥",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
};

const getGainMessage = () => {
    const messages = [
        "Quand on est chaud, on est chaud ! 🔥💰",
        "Il paraît que l’argent ne fait pas le bonheur… mais on peut toujours essayer, non ? 😏💵",
        "On va bientôt devoir louer une remorque pour tout cet argent. 🚚💸",
        "Encore un trade comme ça et c’est champagne ce soir ! 🥂✨",
        "Ils parlent de toi sur Wall Street : 'Le Pro du BTC' ! 🤑📈",
        "Reste concentré… les Bahamas, c’est pas pour tout de suite. 🌴💼",
        "Les calculatrices chauffent : gain validé ! 🧮🔥",
        "Mieux qu’une promo Black Friday : +1 trade gagnant dans la poche ! 🛍️💰",
        "Bientôt, on appellera ça 'la méthode Grégoire' ! 😎🎯",
        "Le portefeuille sourit, et toi aussi. 😄📈",
        "Le marché t’a respecté… et ton portefeuille aussi. 💪📈",
        "Ce n’est pas de la chance, c’est du talent. 🎯💼",
        "Encore un comme ça et Binance te propose un CDI. 💻💰",
        "On dirait bien que tu trades les étoiles. 🌟🚀",
        "Même Warren Buffett veut savoir comment tu fais. 📞📊",
        "Tu ne trades pas… tu danses avec les chiffres. 💃🪙",
        "T’as pas cliqué… t’as déclenché une impression de billets. 🖨️💸",
        "Jackpot validé. On encaisse, on respire, on repart. 🎲✅",
        "Ton wallet commence à prendre de l’embonpoint. 🐷💳",
        "La machine est lancée. Tu viens de passer en mode légende. 🏆🔥",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
};

module.exports = { getLossMessage, getGainMessage };
