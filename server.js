// server.js — Serveur Node.js Unifié — 100% Conforme à la Logique Métier POINT FOCAL
const http = require('http');

const PORT = 3000;

// Bases de données en mémoire (Volatiles — À coupler avec un fichier JSON ou base de données pour la persistance)
const listeHashsUtilises = new Set();
const baseDonneesUtilisateurs = new Map();

// Configuration Réseau BNB Chain (USDT BEP-20)
const NODE_RPC_BNB_CHAIN = "https://bsc-dataseed.binance.org/";
const CONTRAT_USDT_BEP20 = "0x55d398326f99059ff775485246999027b3197955".toLowerCase();
const VOTRE_ADRESSE_RECEPTION = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae".toLowerCase(); 

// Injecter un parrain racine par défaut pour que le système puisse démarrer
baseDonneesUtilisateurs.set("0x0000000000000000000000000000000000000000", {
    codeInvitation: "LOBONGO1",
    liensOpportunites: { "1": "https://victoryautomatic.com/user/register/lobongo01" }
});

function renvoyerJSON(res, statut, donnees) {
    res.writeHead(statut, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(donnees));
}

// Générateur de Code d'invitation conforme : 4 Lettres Majuscules + 4 Chiffres (Ex: AFEG2000)
function genererCodeFormatte() {
    const lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const chiffres = "0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += lettres.charAt(Math.floor(Math.random() * lettres.length));
    for (let i = 0; i < 4; i++) code += chiffres.charAt(Math.floor(Math.random() * chiffres.length));
    return code;
}

// Traitement automatique du Roll-Up 48h
function executerRollUp48h() {
    const maintenant = Math.floor(Date.now() / 1000);
    for (let [adresseUser, profil] of baseDonneesUtilisateurs.entries()) {
        if (profil.etapeActuelle < 3 && (maintenant - profil.timestampCreation) > 172800) {
            console.log(`⚠️ Expiration 48h : Suppression du compte ${adresseUser}`);
            for (let [adresseFilleul, profilFilleul] of baseDonneesUtilisateurs.entries()) {
                if (profilFilleul.parrainInitial === adresseUser) {
                    profilFilleul.parrainInitial = profil.parrainInitial; // Roll-up de la lignée
                }
            }
            baseDonneesUtilisateurs.delete(adresseUser);
        }
    }
}
setInterval(executerRollUp48h, 3600000); // Exécution toutes les heures

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // INTERACTION 1 : INSCRIPTION & INITIALISATION DU TIMEOUT 48H
    if (req.url === '/api/initialiser-compte' && req.method === 'POST') {
        let corps = '';
        req.on('data', chunk => { corps += chunk.toString(); });
        req.on('end', () => {
            try {
                const { adresseUser, codeParrain } = JSON.parse(corps);
                if (!adresseUser) return renvoyerJSON(res, 400, { succes: false, message: "Adresse publique manquante." });

                const key = adresseUser.trim().toLowerCase();
                
                // Recherche du parrain réel dans la base de données
                let parrainValide = "0x0000000000000000000000000000000000000000"; // Racine par défaut
                for (let [adresse, profil] of baseDonneesUtilisateurs.entries()) {
                    if (profil.codeInvitation === codeParrain) {
                        parrainValide = adresse;
                        break;
                    }
                }

                baseDonneesUtilisateurs.set(key, {
                    etapeActuelle: 1, // Inscrit, en attente de visionnage
                    timestampCreation: Math.floor(Date.now() / 1000),
                    parrainInitial: parrainValide,
                    timestampVideoStart: 0,
                    codeInvitation: "",
                    liensOpportunites: {}
                });

                // Renvoyer les informations du parrain trouvé pour configuration du lien dans l'UI
                const profilParrain = baseDonneesUtilisateurs.get(parrainValide);
                return renvoyerJSON(res, 200, { 
                    succes: true, 
                    lienVictoryParrain: profilParrain.liensOpportunites["1"] || "https://victoryautomatic.com/user/register/lobongo01"
                });
            } catch (e) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur traitement inscription." });
            }
        });
    }

    // INTERACTION 2 : VERROUILLAGE DU CHRONO DE 200 SECONDES CÔTÉ SERVEUR
    else if (req.url === '/api/demarrer-video' && req.method === 'POST') {
        let corps = '';
        req.on('data', chunk => { corps += chunk.toString(); });
        req.on('end', () => {
            try {
                const { adresseUser } = JSON.parse(corps);
                const key = adresseUser.trim().toLowerCase();
                const profil = baseDonneesUtilisateurs.get(key);

                if (!profil) return renvoyerJSON(res, 404, { succes: false, message: "Compte non trouvé." });

                profil.timestampVideoStart = Math.floor(Date.now() / 1000);
                profil.etapeActuelle = 2; // Étape de visionnage engagée
                baseDonneesUtilisateurs.set(key, profil);

                return renvoyerJSON(res, 200, { succes: true, message: "Chrono de 200 secondes verrouillé sur le serveur." });
            } catch (e) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur serveur." });
            }
        });
    }

    // INTERACTION 3 : COLLAGE LIEN VICTORY AUTOMATIC & VÉRIFICATION DU PARRAIN
    else if (req.url === '/api/lier-victory' && req.method === 'POST') {
        let corps = '';
        req.on('data', chunk => { corps += chunk.toString(); });
        req.on('end', () => {
            try {
                const { adresseUser, lienVictory } = JSON.parse(corps);
                const key = adresseUser.trim().toLowerCase();
                const profil = baseDonneesUtilisateurs.get(key);

                if (!profil) return renvoyerJSON(res, 403, { succes: false, message: "Session invalide." });

                // Sécurité anti-triche : Vérification des 200 secondes de visionnage réelles
                const maintenant = Math.floor(Date.now() / 1000);
                if (maintenant - profil.timestampVideoStart < 200) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Fraude détectée : Temps de visionnage insuffisant." });
                }

                // Extraction du pseudo du lien collé pour validation
                const partiesLien = lienVictory.trim().split('/');
                const pseudoExtrait = partiesLien[partiesLien.length - 1];

                // RÈGLE MÉTIER STRICTE : Vérifier si le parrain est déjà connu dans notre base de données
                let parrainExisteDansBase = false;
                for (let [adresse, data] of baseDonneesUtilisateurs.entries()) {
                    if (data.liensOpportunites["1"] && data.liensOpportunites["1"].includes(pseudoExtrait)) {
                        parrainExisteDansBase = true;
                        break;
                    }
                }

                if (!parrainExisteDansBase && pseudoExtrait !== "lobongo01") {
                    return renvoyerJSON(res, 400, { succes: false, message: "Refusé : Le parrain de ce lien n'appartient pas à la communauté POINT FOCAL." });
                }

                profil.liensOpportunites["1"] = lienVictory.trim();
                baseDonneesUtilisateurs.set(key, profil);

                return renvoyerJSON(res, 200, { succes: true, message: "Lien Victory validé. Procédez au paiement d'activation." });
            } catch (e) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur de traitement du lien d'affiliation." });
            }
        });
    }

    // INTERACTION 4 : VÉRIFICATION DU PAIEMENT BLOCKCHAIN & GÉNÉRATION CODE UNIQUE
    else if (req.url === '/api/verifier-paiement' && req.method === 'POST') {
        let corpsRequete = '';
        req.on('data', chunk => { corpsRequete += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { adresseCible, txid, timestampLimite } = JSON.parse(corpsRequete);
                const txHash = txid.trim().toLowerCase();
                const adresseUser = adresseCible.trim().toLowerCase();

                if (listeHashsUtilises.has(txHash)) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Ce reçu de paiement a déjà été validé." });
                }

                // Appel RPC nœud BNB Chain
                const reponseReceipt = await fetch(NODE_RPC_BNB_CHAIN, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getTransactionReceipt", params: [txHash], id: 1 })
                });
                const dataReceipt = await reponseReceipt.json();

                if (!dataReceipt || !dataReceipt.result) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Transaction introuvable sur la BSC." });
                }

                const txDetails = dataReceipt.result;
                if (txDetails.status !== "0x1") return renvoyerJSON(res, 400, { succes: false, message: "Échec : Transaction invalide." });

                // Logique de décodage des logs USDT BEP-20
                const topicTransfertStandard = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
                let logValide = txDetails.logs.find(log => 
                    log.address.toLowerCase() === CONTRAT_USDT_BEP20 && log.topics[0].toLowerCase() === topicTransfertStandard
                );

                if (!logValide) return renvoyerJSON(res, 400, { succes: false, message: "Aucun transfert USDT BEP-20 détecté." });

                const destinataireBlockchain = "0x" + logValide.topics[2].slice(26).toLowerCase();
                const montantUSDT = Number(BigInt(logValide.data)) / 10**18;

                if (destinataireBlockchain !== VOTRE_ADRESSE_RECEPTION || adresseUser !== VOTRE_ADRESSE_RECEPTION) {
                    return renvoyerJSON(res, 400, { succes: false, message: "Le dépôt ne correspond pas à la caisse POINT FOCAL." });
                }

                if (montantUSDT < 2.03) {
                    return renvoyerJSON(res, 400, { succes: false, message: `Montant insuffisant. Requis: 2.03 USDT.` });
                }

                // Validation temporelle
                const reponseBlockInfo = await fetch(NODE_RPC_BNB_CHAIN, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: [txDetails.blockNumber, false], id: 2 })
                });
                const dataBlock = await reponseBlockInfo.json();
                if (dataBlock && dataBlock.result) {
                    const txTimestamp = parseInt(dataBlock.result.timestamp, 16);
                    if (txTimestamp < timestampLimite) {
                        return renvoyerJSON(res, 400, { succes: false, message: "La transaction est antérieure à la session de collage." });
                    }
                }

                listeHashsUtilises.add(txHash);

                // Génération du code requis au format 4 lettres + 4 chiffres
                const codeGenere = genererCodeFormatte();
                
                const profil = baseDonneesUtilisateurs.get(txDetails.from.toLowerCase()) || {};
                profil.etapeActuelle = 3; // Payé et définitivement sécurisé (Annulation du compte à rebours de suppression)
                profil.codeInvitation = codeGenere;
                baseDonneesUtilisateurs.set(txDetails.from.toLowerCase(), profil);

                return renvoyerJSON(res, 200, { 
                    succes: true, 
                    message: "Compte activé !", 
                    codeInvitation: codeGenere 
                });
            } catch (err) {
                return renvoyerJSON(res, 500, { succes: false, message: "Erreur critique d'analyse RPC." });
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`🤖 SERVEUR CONFORME POINT FOCAL DISPONIBLE SUR LE PORT ${PORT}`);
});