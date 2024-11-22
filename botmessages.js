export const getLossMessage = () => {
    const messages = [
        "La rivière perce le rocher non par sa force, mais par sa persévérance. 💦",
        "Chaque perte est une leçon, et chaque leçon te rapproche du succès. 📚",
        "Nana korobi ya oki. (Tombe sept fois, relève-toi huit.) 🥋",
        "Le succès n'est pas l'absence d'échec, mais la capacité à se relever après chaque chute. 🧗",
        "La patience est un arbre dont les racines sont amères, mais les fruits sont doux. 🍃",
        "Rien ne se perd, tout s’apprend. 🌱",
        "L'échec est simplement l'opportunité de recommencer, cette fois plus intelligemment. 🧠",
        "Même les plus grandes montagnes se gravissent un pas à la fois. 🏔️",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

export const getGainMessage = () => {
    const messages = [
        "Quand on est chaud, on est chaud ! 🔥💰",
        "Il paraît que l’argent ne fait pas le bonheur… mais on peut toujours essayer, non ? 😏💵",
        "On va bientôt devoir louer une remorque pour tout cet argent. 🚚💸",
        "Encore un trade comme ça et c’est champagne ce soir ! 🥂✨",
        "Ils parlent de toi sur Wall Street : 'Le Pro du BTC' ! 🤑📈",
        "Reste concentré… les Bahamas, c’est pas pour tout de suite. 🌴💼",
        "Les calculatrices chauffent : gain validé ! 🧮🔥",
        "Mieux qu’une promo Black Friday : +1 trade gagnant dans la poche ! 🛍️💰",
        "Bientôt, on appellera ça 'la méthode [Ton Prénom]' ! 😎🎯",
        "Le portefeuille sourit, et toi aussi. 😄📈",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
};
