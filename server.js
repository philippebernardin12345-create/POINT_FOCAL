// server.js — Serveur Node.js NATIF (Sans Express, Sans Axios, Sans BscScan)
const http = require('http');

const PORT = 3000;

// 🔐 Base de données en mémoire pour l'unicité des Hashs (Anti-rejeu)
const listeHashsUtilises = new Set();

// 🟢 CONFIGURATION OFFICIELLE USDT BEP-20 & RÉSEAU BNB CHAIN
const NODE_RPC_BNB_CHAIN = "https://bsc-dataseed.binance.org/";
const CONTRAT_USDT_BEP20 = "0x55d398326f99059ff775485246999027b3197955".toLowerCase();

// 🔴 METS TON ADRESSE DE RÉCEPTION ICI
const VOTRE_ADRESSE_RECEPTION = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae".toLowerCase(); 

// Fonction utilitaire pour renvoyer le JSON et gérer le CORS (pour l'intégration avec app.js)
function renvoyerJSON(res, statut, donnees) {
    res.writeHead(statut, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(donnees));
}

// Création du serveur HTTP natif
const server = http.createServer((req, res) => {
    
    // Gestion du protocole de sécurité CORS (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // Route unique de vérification du paiement
    if (req.url === '/api/verifier-paiement' && req.method === 'POST') {
        let corpsRequete = '';

        // Lecture du flux de données envoyé par le frontend
        req.on('data', chunk => { corpsRequete += chunk.toString(); });

        req.on('end', async () => {
            try {
                const { adresseCible, txid, timestampLimite } = JSON.parse(corpsRequete);

                // 1️⃣ Vérification des données requises
                if (!adresseCible || !txid || !timestampLimite) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Données manquantes." });
                }

                const txHash = txid.trim().toLowerCase();
                const adresseUser = adresseCible.trim().toLowerCase();

                // 2️⃣ Sécurité Anti-rejeu (Évite qu'un utilisateur valide 2 comptes avec le même reçu)
                if (listeHashsUtilises.has(txHash)) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Ce reçu de paiement a déjà été validé." });
                }

                // 3️⃣ Appel direct au nœud BNB Chain pour récupérer le reçu de transaction (Receipt)
                const reponseReceipt = await fetch(NODE_RPC_BNB_CHAIN, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_getTransactionReceipt",
                        params: [txHash],
                        id: 1
                    })
                });
                const dataReceipt = await reponseReceipt.json();

                if (!dataReceipt || !dataReceipt.result) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Transaction introuvable. Attendez la confirmation du réseau." });
                }

                const txDetails = dataReceipt.result;

                // Statut "0x1" signifie que la transaction a réussi sur la blockchain
                if (txDetails.status !== "0x1") {
                    return renvoyerJSON(res, 400, { succes: false, message: "La transaction a échoué sur la Blockchain." });
                }

                // 4️⃣ Extraction et analyse des logs de transfert du jeton USDT BEP-20
                const topicTransfertStandard = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
                let logValide = null;

                if (txDetails.logs && txDetails.logs.length > 0) {
                    logValide = txDetails.logs.find(log => 
                        log.address.toLowerCase() === CONTRAT_USDT_BEP20 && 
                        log.topics[0].toLowerCase() === topicTransfertStandard
                    );
                }

                if (!logValide) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Aucun transfert d'USDT BEP-20 détecté dans cette transaction." });
                }

                // Décodage de l'adresse de réception depuis les logs de la blockchain
                const destinataireBlockchain = "0x" + logValide.topics[2].slice(26).toLowerCase();
                
                // Décodage du montant (l'USDT possède 18 décimales sur la BNB Chain)
                const montantBrutHex = logValide.data;
                const montantUSDT = Number(BigInt(montantBrutHex)) / 10**18;

                // 5️⃣ Contrôles de sécurité croisés (Adresses et Montant minimum de 5$)
                if (destinataireBlockchain !== VOTRE_ADRESSE_RECEPTION || adresseUser !== VOTRE_ADRESSE_RECEPTION) {
                    return renvoyerJSON(res, 400, { succes: false, message: "L'adresse de destination ne correspond pas au système Point Focal." });
                }

                if (montantUSDT < 5) {
                    return renvoyerJSON(res, 400, { succes: false, message: `Montant insuffisant. Requis: 5$ USDT. Reçu: ${montantUSDT.toFixed(2)}$ USDT.` });
                }

                // 6️⃣ Sécurité Chronologique : On récupère le timestamp du bloc pour contrer les vieux reçus
                const reponseBlockInfo = await fetch(NODE_RPC_BNB_CHAIN, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_getBlockByNumber",
                        params: [txDetails.blockNumber, false],
                        id: 2
                    })
                });
                const dataBlock = await reponseBlockInfo.json();

                if (dataBlock && dataBlock.result) {
                    const txTimestampSecondes = parseInt(dataBlock.result.timestamp, 16);

                    // Si le bloc est plus vieux que le moment où le user a cliqué/collé son lien, c'est une fraude
                    if (txTimestampSecondes < timestampLimite) {
                        return renvoyerJSON(res, 400, { succes: false, message: "Alerte Sécurité : Ce paiement a été effectué avant votre session d'inscription." });
                    }
                }

                // 7️⃣ Succès : Verrouillage du Hash pour empêcher toute réutilisation
                listeHashsUtilises.add(txHash);
                
                return renvoyerJSON(res, 200, { 
                    succes: true, 
                    message: "Paiement USDT BEP-20 validé avec succès !", 
                    montant: montantUSDT 
                });

            } catch (err) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur lors du traitement réseau du nœud RPC." });
            }
        });
    } else {
        renvoyerJSON(res, 404, { succes: false, message: "Route introuvable." });
    }
});

// Lancement du serveur
server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🤖 SERVEUR RPC DIRECT ACTIF (PORT : ${PORT})`);
    console.log(`🪙 DEVISE ÉCOUTÉE : USDT BEP-20 (BNB CHAIN)`);
    console.log(`====================================================`);
});