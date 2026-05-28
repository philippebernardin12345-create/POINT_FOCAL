// server.js — Serveur Node.js NATIF (Sans Express, Sans Axios, Sans BscScan) — 100% RPC Direct BNB Chain
const http = require('http');

const PORT = 3000;

// Base de données volatile pour l'unicité des Hashs (Anti-rejeu)
const listeHashsUtilises = new Set();

// Système de suivi temporaire de la progression des utilisateurs pour le Follow-Me
// Clé : adresse utilisateur (lowercase) -> Valeur : { etapeActuelle: 1, liensOpportunites: { '2': '...', '3': '...' } }
const progressionUtilisateurs = new Map();

// Configuration USDT BEP-20 (Réseau principal BNB Chain)
const NODE_RPC_BNB_CHAIN = "https://bsc-dataseed.binance.org/";
const CONTRAT_USDT_BEP20 = "0x55d398326f99059ff775485246999027b3197955".toLowerCase();

// 🔴 CONFIGURATION REQUIS : AJOUTE TON ADRESSE DE RÉCEPTION FINALE ICI
const VOTRE_ADRESSE_RECEPTION = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae".toLowerCase(); 

function renvoyerJSON(res, statut, donnees) {
    res.writeHead(statut, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(donnees));
}

const server = http.createServer((req, res) => {
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // ==========================================================
    // ROUTE 1 : VÉRIFICATION ET VALIDATION DU PAIEMENT INITIAL
    // ==========================================================
    if (req.url === '/api/verifier-paiement' && req.method === 'POST') {
        let corpsRequete = '';

        req.on('data', chunk => { corpsRequete += chunk.toString(); });

        req.on('end', async () => {
            try {
                const { adresseCible, txid, timestampLimite } = JSON.parse(corpsRequete);

                if (!adresseCible || !txid || !timestampLimite) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Données manquantes." });
                }

                const txHash = txid.trim().toLowerCase();
                const adresseUser = adresseCible.trim().toLowerCase();

                // Sécurité : Unicité du Hash
                if (listeHashsUtilises.has(txHash)) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Ce reçu de paiement a déjà été validé par le système." });
                }

                // Appel RPC : Récupération du Reçu de Transaction Blockchain
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
                    return renvoyerJSON(res, 400, { succes: false, message: "Transaction introuvable ou non confirmée par les mineurs." });
                }

                const txDetails = dataReceipt.result;

                if (txDetails.status !== "0x1") {
                    return renvoyerJSON(res, 400, { succes: false, message: "Échec : La transaction blockchain est invalide (Status Reverted)." });
                }

                // Analyse des logs d'événement de transfert USDT BEP-20
                const topicTransfertStandard = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
                let logValide = null;

                if (txDetails.logs && txDetails.logs.length > 0) {
                    logValide = txDetails.logs.find(log => 
                        log.address.toLowerCase() === CONTRAT_USDT_BEP20 && 
                        log.topics[0].toLowerCase() === topicTransfertStandard
                    );
                }

                if (!logValide) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Erreur : Aucun transfert de jetons USDT BEP-20 détecté dans cette transaction." });
                }

                // Décodage des paramètres logués
                const destinataireBlockchain = "0x" + logValide.topics[2].slice(26).toLowerCase();
                const montantBrutHex = logValide.data;
                const montantUSDT = Number(BigInt(montantBrutHex)) / 10**18;

                // Validation croisée des adresses cibles
                if (destinataireBlockchain !== VOTRE_ADRESSE_RECEPTION || adresseUser !== VOTRE_ADRESSE_RECEPTION) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Erreur : Le portefeuille de dépôt ne correspond pas à la caisse Point Focal." });
                }

                // CORRECTIF : Ajusté précisément à 2,03 USDT
                if (montantUSDT < 2.03) {
                    return renvoyerJSON(res, 400, { succes: false, message: `Montant insuffisant. Requis : 2.03$ USDT, Reçu : ${montantUSDT.toFixed(2)}$ USDT.` });
                }

                // Sécurité chronologique anti-fraude (Récupération de l'horodatage du bloc)
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

                    if (txTimestampSecondes < timestampLimite) {
                        return renvoyerJSON(res, 400, { succes: false, message: "Sécurité : Ce paiement est expiré ou antérieur à votre session." });
                    }
                }

                // Validation Définitive & Enregistrement de l'état Payé
                listeHashsUtilises.add(txHash);
                
                progressionUtilisateurs.set(txDetails.from.toLowerCase(), {
                    etapeActuelle: 1,
                    liensOpportunites: {}
                });

                return renvoyerJSON(res, 200, { 
                    succes: true, 
                    message: "Paiement USDT BEP-20 validé !", 
                    montant: montantUSDT,
                    user: txDetails.from.toLowerCase()
                });

            } catch (err) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur d'analyse ou crash lors du décodage RPC." });
            }
        });
    } 
    
    // ==========================================================
    // ROUTE 2 : ALIMENTATION SECURISEE DES OPPORTUNITES (2, 3, 4...)
    // ==========================================================
    else if (req.url === '/api/enregistrer-opportunite' && req.method === 'POST') {
        let corpsRequete = '';

        req.on('data', chunk => { corpsRequete += chunk.toString(); });

        req.on('end', () => {
            try {
                const { adresseUser, etapeVisee, lienOpportunite } = JSON.parse(corpsRequete);

                if (!adresseUser || !etapeVisee || !lienOpportunite) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Données de formulaire incomplètes." });
                }

                const userKey = adresseUser.trim().toLowerCase();

                // VERROU STRICT : L'utilisateur existe-t-il et a-t-il payé l'opportunité initiale ?
                const profilUser = progressionUtilisateurs.get(userKey);
                if (!profilUser) {
                    return renvoyerJSON(res, 403, { 
                        succes: false, 
                        message: "Accès interdit : Vous devez obligatoirement valider l'accès Point Focal à 2,03 USDT au préalable." 
                    });
                }

                // Vérification de la chronologie du tunnel (Pas de saut d'étape)
                if (etapeVisee !== profilUser.etapeActuelle + 1) {
                    return renvoyerJSON(res, 400, { 
                        succes: false, 
                        message: `Ordre non respecté. Vous devez valider l'étape ${profilUser.etapeActuelle + 1}.` 
                    });
                }

                // Enregistrement du lien pour alimenter le système Follow-Me
                profilUser.liensOpportunites[etapeVisee.toString()] = lienOpportunite.trim();
                profilUser.etapeActuelle = etapeVisee;
                progressionUtilisateurs.set(userKey, profilUser);

                return renvoyerJSON(res, 200, { 
                    succes: true, 
                    message: `Opportunité ${etapeVisee} liée avec succès. Données de duplication mises à jour.` 
                });

            } catch (err) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur lors de l'enregistrement de l'opportunité." });
            }
        });
    } 
    
    else {
        renvoyerJSON(res, 404, { succes: false, message: "Route introuvable." });
    }
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🤖 SERVEUR RPC DIRECT ACTIF (PORT : ${PORT})`);
    console.log(`🪙 DEVISE ÉCOUTÉE : USDT BEP-20 (BNB CHAIN)`);
    console.log(`====================================================`);
});