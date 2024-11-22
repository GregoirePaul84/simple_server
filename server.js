const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware pour traiter les JSON reçus
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Le serveur fonctionne correctement !');
});

// Endpoint Webhook pour recevoir les alertes
app.post('/webhook', (req, res) => {
    const alert = req.body;

    console.log('Alerte reçue:', alert);

    // Traiter les alertes ici (achat/vente, log, etc.)
    res.status(200).send('Alerte reçue !');
});

// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
