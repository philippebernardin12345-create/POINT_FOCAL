// server.js — Serveur Node.js NATIF — Spécification Logique Métier POINT FOCAL
const http = require('http');

const PORT = 3000;

// Base de données volatile (Anti-rejeu des Hashs)
const listeHashsUtilises = new Set();

// Base de données en mémoire pour la progression, les chronos de 48h et le Follow-Me
// Structure : adresseUser => { etapeActuelle, timestampCreation, parrainInitial, liens: { opp1, opp2, opp3... } }
const baseDonneesUtilisateurs = new Map();

// Configuration Réseau BNB Chain
const NODE_RPC_BNB_CHAIN = "https://bsc-dataseed.binance.org/";
const CONTRAT_USDT_BEP20 = "0x55d398326f99059ff775485246999027b3197955".toLowerCase();

// Adresse de réception officielle de la caisse POINT FOCAL
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

// Fonction de nettoyage automatique (Vérification et application du Roll-Up 48h)
function executerRollUp48h() {
    const maintenant = Math.floor(Date.now() / 1000);
    for (let [adresseUser, profil] of baseDonneesUtilisateurs.entries()) {
        // Si l'utilisateur a initié l'étape 1 mais n'a pas généré son lien (étape < 2) après 48h
        if (profil.etapeActuelle < 2 && (maintenant - profil.timestampCreation) > 172800) {
            console.log(`⚠️ Expiraion 48h détectée pour ${adresseUser}. Application du Roll-up Matrix.`);
            
            // Logique Roll-up : On transfère ses filleuls vers son parrain initial
            for (let [adresseFilleul, profilFilleul] of baseDonneesUtilisateurs.entries()) {
                if (profilFilleul.parrainInitial === adresseUser) {
                    profilFilleul.parrainInitial = profil.parrainInitial; // Remontée de lignée
                    baseDonneesUtilisateurs.set(adresseFilleul, profilFilleul);
                }
            }
            // Suppression définitive du compte obsolète
            baseDonneesUtilisateurs.delete(adresseUser);
        }
    }
}
// Exécuter la vérification du Roll-up toutes les heures
setInterval(executerRollUp48h, 3600000);

const server = http.createServer((req, res) => {
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // INTERACTION 1 : INITIALISATION DE L'INSCRIPTION & CHRONO 48H
    if (req.url === '/api/initialiser-compte' && req.method === 'POST') {
        let corps = '';
        req.on('data', chunk => { corps += chunk.toString(); });
        req.on('end', () => {
            try {
                const { adresseUser, parrain } = JSON.parse(corps);
                if (!adresseUser) return renvoyerJSON(res, 400, { succes: false, message: "Adresse manquante." });
                
                const key = adresseUser.trim().toLowerCase();
                
                // Initialisation du profil avec verrou temporel de 48 heures (172800 secondes)
                baseDonneesUtilisateurs.set(key, {
                    etapeActuelle: 1, // Phase d'attente de paiement
                    timestampCreation: Math.floor(Date.now() / 1000),
                    parrainInitial: parrain ? parrain.trim().toLowerCase() : "lobongo01",
                    liensOpportunites: { "1": "https://victoryautomatic.com/user/register/lobongo01" }
                });

                return renvoyerJSON(res, 200, { succes: true, message: "Session de 48 heures initialisée. En attente du paiement de 2,03 USDT." });
            } catch (e) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur d'initialisation." });
            }
        });
    }

    // INTERACTION 2 : VERIFICATION STRICTE DU PAIEMENT BLOCKCHAIN
    else if (req.url === '/api/verifier-paiement' && req.method === 'POST') {
        let corpsRequete = '';
        req.on('data', chunk => { corpsRequete += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { adresseCible, txid, timestampLimite } = JSON.parse(corpsRequete);

                if (!adresseCible || !txid || !timestampLimite) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Données de transaction incomplètes." });
                }

                const txHash = txid.trim().toLowerCase();
                const adresseUser = adresseCible.trim().toLowerCase();

                if (listeHashsUtilises.has(txHash)) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Ce reçu de paiement a déjà été validé." });
                }

                // Appel RPC nœud BNB Chain
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
                    return renvoyerJSON(res, 400, { succes: false, message: "Transaction introuvable sur la BSC." });
                }

                const txDetails = dataReceipt.result;
                if (txDetails.status !== "0x1") {
                    return renvoyerJSON(res, 400, { succes: false, message: "Échec : Statut blockchain invalide (Reverted)." });
                }

                // Analyse des logs USDT BEP-20
                const topicTransfertStandard = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
                let logValide = txDetails.logs ? txDetails.logs.find(log => 
                    log.address.toLowerCase() === CONTRAT_USDT_BEP20 && 
                    log.topics[0].toLowerCase() === topicTransfertStandard
                ) : null;

                if (!logValide) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Aucun transfert USDT BEP-20 détecté." });
                }

                const destinataireBlockchain = "0x" + logValide.topics[2].slice(26).toLowerCase();
                const montantUSDT = Number(BigInt(logValide.data)) / 10**18;

                if (destinataireBlockchain !== VOTRE_ADRESSE_RECEPTION || adresseUser !== VOTRE_ADRESSE_RECEPTION) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Le portefeuille récepteur ne correspond pas à la caisse POINT FOCAL." });
                }

                // Validation stricte du montant à 2.03 USDT
                if (montantUSDT < 2.03) {
                    return renvoyerJSON(res, 400, { succes: false, message: `Montant insuffisant. Requis : 2.03$ USDT, Reçu : ${montantUSDT.toFixed(2)}$ USDT.` });
                }

                // Sécurité Chronologique : Le bloc doit être postérieur à la saisie de l'adresse cible
                const reponseBlockInfo = await fetch(NODE_RPC_BNB_CHAIN, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: [txDetails.blockNumber, false], id: 2 })
                });
                const dataBlock = await reponseBlockInfo.json();

                if (dataBlock && dataBlock.result) {
                    const txTimestampSecondes = parseInt(dataBlock.result.timestamp, 16);
                    if (txTimestampSecondes < timestampLimite) {
                        return renvoyerJSON(res, 400, { succes: false, message: "Sécurité : La transaction est antérieure à votre session de collage." });
                    }
                }

                // Validation et passage à l'étape supérieure (Sauvegarde de l'état payé, débloquant le droit au lien)
                listeHashsUtilises.add(txHash);
                
                const profil = baseDonneesUtilisateurs.get(txDetails.from.toLowerCase()) || { etapeActuelle: 1, liensOpportunites: {} };
                profil.etapeActuelle = 2; // Étape 2 atteinte : Paiement Validé et sécurisé
                baseDonneesUtilisateurs.set(txDetails.from.toLowerCase(), profil);

                return renvoyerJSON(res, 200, { 
                    succes: true, 
                    message: "Paiement USDT BEP-20 validé avec succès !", 
                    user: txDetails.from.toLowerCase()
                });

            } catch (err) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur lors du décodage RPC." });
            }
        });
    } 
    
    // INTERACTION 3 : ENREGISTREMENT DES OPPORTUNITES DU TUNNEL (FOLLOW-ME)
    else if (req.url === '/api/enregistrer-opportunite' && req.method === 'POST') {
        let corpsRequete = '';
        req.on('data', chunk => { corpsRequete += chunk.toString(); });
        req.on('end', () => {
            try {
                const { adresseUser, etapeVisee, lienOpportunite } = JSON.parse(corpsRequete);
                const userKey = adresseUser.trim().toLowerCase();
                const profilUser = baseDonneesUtilisateurs.get(userKey);

                // Blocage absolu si l'étape 1 (Paiement) n'est pas validée côté serveur
                if (!profilUser || profilUser.etapeActuelle < 2) {
                    return renvoyerJSON(res, 403, { succes: false, message: "Accès refusé : Paiement initial non validé ou délai de 48h dépassé." });
                }

                // Sauvegarde du lien pour le mécanisme d'affiliation dynamique "Follow-me"
                profilUser.liensOpportunites[etapeVisee.toString()] = lienOpportunite.trim();
                baseDonneesUtilisateurs.set(userKey, profilUser);

                return renvoyerJSON(res, 200, { succes: true, message: `Opportunité ${etapeVisee} enregistrée.` });
            } catch (err) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur serveur." });
            }
        });
    } 
    
    else {
        renvoyerJSON(res, 404, { succes: false, message: "Route introuvable." });
    }
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🤖 POINT FOCAL — SERVEUR RPC ACTIF (PORT : ${PORT})`);
    console.log(`🪙 CIBLE DE VALIDATION : 2,03 USDT BEP-20`);
    console.log(`====================================================`);
});