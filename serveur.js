require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Configuration du réseau Binance Smart Chain (BSC)
const BSC_RPC_URL = "https://rpc.ankr.com/bsc"; // Nœud public et stable
const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);

// 2. Configuration du contrat intelligent (Smart Contract) officiel de l'USDT sur la BSC
const USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
// On définit l'ABI minimum pour écouter le transfert de jetons (Transfer)
const USDT_ABI = [
    "function name() view returns (string)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// 3. Route de vérification automatique du paiement
app.post('/api/verifier-paiement', async (req, res) => {
    const { adresseCible, txid } = req.body;

    // Protections de base au cas où le frontend aurait été contourné
    if (!adresseCible || !txid || adresseCible.length !== 42 || txid.length !== 66) {
        return res.status(400).json({ succes: false, message: "Formats blockchain invalides." });
    }

    try {
        // A. On récupère le reçu de la transaction sur la BSC
        const recu = await provider.getTransactionReceipt(txid);
        
        if (!recu) {
            return res.status(404).json({ succes: false, message: "Transaction introuvable sur la BSC. Attendez 10 secondes et réessayez." });
        }

        // B. Vérification du statut de la transaction (1 = Succès, 0 = Échec)
        if (recu.status !== 1) {
            return res.status(400).json({ succes: false, message: "Cette transaction a échoué sur la blockchain." });
        }

        // C. Analyse des "Logs" pour trouver le vrai transfert USDT
        const interfaceUsdt = new ethers.Interface(USDT_ABI);
        let paiementValide = false;
        let montantDetecte = 0;

        for (const log of recu.logs) {
            // On vérifie si le log provient bien du contrat officiel USDT
            if (log.address.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase()) {
                try {
                    const logDecode = interfaceUsdt.parseLog({ topics: [...log.topics], data: log.data });
                    
                    if (logDecode && logDecode.name === "Transfer") {
                        const destination = logDecode.args.to;
                        const valeur = logDecode.args.value;

                        // L'USDT possède 18 décimales sur la BSC
                        const montantFormatte = parseFloat(ethers.formatUnits(valeur, 18));

                        // Est-ce que les fonds sont arrivés sur TON portefeuille de réception ?
                        if (destination.toLowerCase() === process.env.PORTEFEUILLE_RECEPTION.toLowerCase()) {
                            montantDetecte = montantFormatte;
                            // On vérifie que le montant est d'au moins 4.95$ (pour pallier d'éventuels micro-frais)
                            if (montantFormatte >= 4.95) {
                                paiementValide = true;
                                break; // Paiement trouvé et validé, on arrête la boucle !
                            }
                        }
                    }
                } catch (errLog) {
                    // Ignorer les logs qui ne correspondent pas à notre structure standard
                }
            }
        }

        if (paiementValide) {
            // !!! ICI : Tu pourras ajouter ta ligne de code pour activer le membre dans ta base de données !!!
            return res.json({ 
                succes: true, 
                message: "Paiement validé !", 
                montant: montantDetecte 
            });
        } else {
            return res.status(400).json({ 
                succes: false, 
                message: `Tricherie détectée ou erreur : Aucun transfert de 5$ USDT trouvé vers ton adresse. (Montant détecté vers ton adresse : ${montantDetecte}$)` 
            });
        }

    } catch (erreur) {
        console.error("Erreur Blockchain :", erreur);
        return res.status(500).json({ succes: false, message: "Erreur lors de la connexion au réseau BSC." });
    }
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur Point Focal actif sur le port ${PORT}`);
});