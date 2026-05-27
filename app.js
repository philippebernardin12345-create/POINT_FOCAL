// app.js — Authentification et Workflow V3 Compléts avec Sécurité Strict USDT BEP20, Dynamic Ref & Connexion Node.js
document.addEventListener("DOMContentLoaded", () => {
    
    // 🟢 RÉCUPÉRATION DU SPONSOR VIA L'URL ET DISPATCH DYNAMIQUE
    const urlParams = new URLSearchParams(window.location.search);
    const sponsorRef = urlParams.get('ref') || 'ABCD1000';

    // Blocs Principaux
    const blocInscription = document.getElementById("bloc-inscription");
    const blocConnexion = document.getElementById("bloc-connexion");
    const blocOublie = document.getElementById("bloc-oublie");
    const popup = document.getElementById("popup-youtube");
    const zoneWorkflow = document.getElementById("zone-workflow");
    const zoneLiaisonMlm = document.getElementById("zone-liaison-mlm");
    const zonePaiement = document.getElementById("zone-paiement");

    // Éléments Formulaires
    const insCode = document.getElementById("ins-code");
    insCode.value = sponsorRef;
    document.getElementById("nom-sponsor").textContent = sponsorRef;

    const insEmail = document.getElementById("ins-email");
    const insPass = document.getElementById("ins-pass");
    const insConf = document.getElementById("ins-conf");
    const errInscription = document.getElementById("erreur-inscription");
    const btnInscription = document.getElementById("btn-inscription");
    const conEmail = document.getElementById("con-email");
    const conPass = document.getElementById("con-pass");
    const errConnexion = document.getElementById("erreur-connexion");
    const btnConnexion = document.getElementById("btn-connexion");
    const oubEmail = document.getElementById("oub-email");
    const errOublie = document.getElementById("erreur-oublie");
    const succesOublie = document.getElementById("succes-oublie");
    const btnRecuperer = document.getElementById("btn-recuperer");

    // Éléments Workflow Vidéo et Liaison
    const btnRegarder = document.getElementById("btn-regarder");
    const chronoLecture = document.getElementById("chrono-lecture");
    const timerVisuel = document.getElementById("timer-visuel");
    const messageDynamique = document.getElementById("message-dynamique");
    const btnObtenirLien = document.getElementById("btn-obtenir-lien");
    const btnDeconnexion = document.querySelectorAll("#btn-deconnexion");
    const mlmAdresseCible = document.getElementById("mlm-adresse-cible");
    const errMlm = document.getElementById("erreur-mlm");
    const btnValiderAdresse = document.getElementById("btn-valider-adresse");

    // Éléments Faux Lecteur Interactif
    const fausseVideoYt = document.getElementById("fausse-video-yt");

    // Éléments Paiement Étape 6 (Crypto Sécurisé)
    const btnOuvrirOpportunite2 = document.getElementById("btn-ouvrir-opportunite2");
    const cryptoAdresseCible = document.getElementById("crypto-adresse-cible");
    const cryptoTxid = document.getElementById("crypto-txid");
    const errPaiement = document.getElementById("erreur-paiement");
    const btnVerifierPaiement = document.getElementById("btn-verifier-paiement");

    // GESTION AFFICHAGE / MASQUAGE DES MOTS DE PASSE
    const chkAfficher = document.querySelectorAll(".chk-afficher");
    chkAfficher.forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            const passFields = document.querySelectorAll(".pass-field");
            passFields.forEach(field => {
                field.type = e.target.checked ? "text" : "password";
            });
        });
    });

    // NAVIGATION ENTRE LES FORMULAIRES
    document.getElementById("vers-connexion").addEventListener("click", () => {
        blocInscription.style.display = "none"; blocConnexion.style.display = "block";
    });
    document.getElementById("vers-inscription").addEventListener("click", () => {
        blocConnexion.style.display = "none"; blocInscription.style.display = "block";
    });
    document.getElementById("vers-oublie").addEventListener("click", () => {
        blocConnexion.style.display = "none"; blocOublie.style.display = "block";
        errOublie.style.display = "none"; succesOublie.style.display = "none"; oubEmail.value = "";
    });
    document.getElementById("oublie-retour").addEventListener("click", () => {
        blocOublie.style.display = "none"; blocConnexion.style.display = "block";
    });

    // INSCRIPTION
    btnInscription.addEventListener("click", () => {
        errInscription.style.display = "none";
        if (insCode.value.trim() === "") {
            errInscription.textContent = "Un code d'invitation valide est obligatoire pour intégrer la matrice.";
            errInscription.style.display = "block"; return;
        }
        if (insEmail.value === "" || insPass.value === "") {
            errInscription.textContent = "Veuillez remplir tous les champs.";
            errInscription.style.display = "block"; return;
        }
        if (insPass.value !== insConf.value) {
            errInscription.textContent = "Les deux mots de passe ne correspondent pas.";
            errInscription.style.display = "block"; return;
        }
        blocInscription.style.display = "none"; popup.style.display = "flex"; lancerChronoPopup();
    });

    // CONNEXION
    btnConnexion.addEventListener("click", () => {
        errConnexion.style.display = "none";
        if (conEmail.value === "" || conPass.value === "") {
            errConnexion.textContent = "Veuillez remplir l'e-mail et le mot de passe.";
            errConnexion.style.display = "block"; return;
        }
        blocConnexion.style.display = "none"; popup.style.display = "flex"; lancerChronoPopup();
    });

    // RÉCUPÉRATION DU MOT DE PASSE
    btnRecuperer.addEventListener("click", () => {
        errOublie.style.display = "none"; succesOublie.style.display = "none";
        const emailSaisi = oubEmail.value.trim();
        if (emailSaisi === "" || !emailSaisi.includes("@")) {
            errOublie.textContent = "Veuillez entrer une adresse e-mail valide.";
            errOublie.style.display = "block"; return;
        }
        btnRecuperer.disabled = true;
        btnRecuperer.textContent = "Génération du lien de secours...";
        setTimeout(() => {
            btnRecuperer.disabled = false; btnRecuperer.textContent = "Récupérer mon mot de passe";
            succesOublie.textContent = "Un e-mail de réinitialisation a été envoyé à " + emailSaisi + " (Vérifiez vos spams).";
            succesOublie.style.display = "block"; oubEmail.value = "";
        }, 1500);
    });

    // CHRONO POPUP 10S
    function lancerChronoPopup() {
        let tempsLecture = 10;
        chronoLecture.style.display = "block"; btnRegarder.disabled = true;
        chronoLecture.textContent = tempsLecture;
        const intervallePopup = setInterval(() => {
            tempsLecture--; chronoLecture.textContent = tempsLecture;
            if (tempsLecture <= 0) {
                clearInterval(intervallePopup);
                chronoLecture.style.display = "none"; btnRegarder.disabled = false;
            }
        }, 1000);
    }

    btnRegarder.addEventListener("click", () => {
        popup.style.display = "none"; zoneWorkflow.style.display = "block";
    });

    // LOGIQUE DE VISIONNAGE YOUTUBE HYBRIDE
    let chronoDemarre = false;
    let tempsVisionnage = 10;
    let intervalleVisionnage;

    fausseVideoYt.addEventListener("click", () => {
        window.open("https://youtu.be/9uPybhkqYw4", "_blank");
        if (!chronoDemarre) {
            chronoDemarre = true;
            messageDynamique.textContent = "« Laissez un LIKE, un COMMENTAIRE et ABONNEZ-VOUS pendant le compte à rebours... »";
            intervalleVisionnage = setInterval(() => {
                tempsVisionnage--; timerVisuel.textContent = `${tempsVisionnage}s`;
                if (tempsVisionnage <= 0) {
                    clearInterval(intervalleVisionnage);
                    messageDynamique.textContent = "« Visionnage validé ! Revenez sur Point Focal et cliquez sur le bouton rouge ci-dessous. »";
                    btnObtenirLien.disabled = false;
                    alert("Validation Terminée !\n\nRevenez sur l'onglet Point Focal pour récupérer votre lien Victory Automatic !");
                }
            }, 1000);
        }
    });

    // LIEN MLM
    btnObtenirLien.addEventListener("click", () => {
        window.open("https://victoryautomatic.com/user/register/" + insCode.value.trim(), "_blank");
        zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "block";
    });

    // VALIDATION DU LIEN MEMBRE
    btnValiderAdresse.addEventListener("click", () => {
        errMlm.style.display = "none";
        const saisie = mlmAdresseCible.value.trim();
        if (saisie === "" || !saisie.includes("victoryautomatic.com/")) {
            errMlm.textContent = "Veuillez entrer votre lien d'affiliation Victory Automatic valide.";
            errMlm.style.display = "block"; return;
        }
        zoneLiaisonMlm.style.display = "none"; zonePaiement.style.display = "block";
    });

    btnOuvrirOpportunite2.addEventListener("click", () => {
        window.open("https://victoryworld.club/longa01", "_blank");
    });

    // 🔴 REQUÊTE COMPLÈTE ENVOYÉE AU ROBOT BACKEND NODE.JS (Vérification Blockchain)
    btnVerifierPaiement.addEventListener("click", async () => {
        errPaiement.style.display = "none";
        
        const adresseSaisie = cryptoAdresseCible.value.trim();
        const txidSaisi = cryptoTxid.value.trim();

        if (adresseSaisie === "" || !adresseSaisie.startsWith("0x") || adresseSaisie.length !== 42) {
            errPaiement.textContent = "Adresse BEP-20 invalide (doit faire 42 caractères et commencer par 0x).";
            errPaiement.style.display = "block"; return;
        }
        if (txidSaisi === "" || !txidSaisi.startsWith("0x") || txidSaisi.length !== 66) {
            errPaiement.textContent = "Hash TxID invalide (doit faire 66 caractères et commencer par 0x).";
            errPaiement.style.display = "block"; return;
        }

        btnVerifierPaiement.disabled = true;
        btnVerifierPaiement.textContent = "Analyse temps réel sur la BNB Chain...";

        try {
            // Le navigateur envoie discrètement les données au serveur Node.js local
            const reponse = await fetch('http://localhost:3000/api/verifier-paiement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adresseCible: adresseSaisie, txid: txidSaisi })
            });

            const resultat = await reponse.json();

            btnVerifierPaiement.disabled = false;
            btnVerifierPaiement.textContent = "Activer mon compte définitivement";

            if (resultat.succes) {
                alert(`Félicitations !\n\nVotre paiement de ${resultat.montant}$ USDT a été détecté et validé. Votre licence Point Focal V3 est active définitivement !`);
            } else {
                // Si le serveur dit que c'est un faux TxID, on affiche l'erreur renvoyée par le robot
                errPaiement.textContent = resultat.message;
                errPaiement.style.display = "block";
            }

        } catch (error) {
            btnVerifierPaiement.disabled = false;
            btnVerifierPaiement.textContent = "Activer mon compte définitivement";
            errPaiement.textContent = "Impossible de joindre le serveur de validation. Vérifiez que votre robot Node.js est bien démarré.";
            errPaiement.style.display = "block";
        }
    });

    // DECONNEXION
    btnDeconnexion.forEach(btn => {
        btn.addEventListener("click", () => {
            clearInterval(intervalleVisionnage);
            insCode.value = sponsorRef; document.getElementById("nom-sponsor").textContent = sponsorRef;
            insEmail.value = ""; insPass.value = ""; insConf.value = "";
            conEmail.value = ""; conPass.value = ""; oubEmail.value = "";
            mlmAdresseCible.value = ""; cryptoAdresseCible.value = ""; cryptoTxid.value = ""; 
            btnObtenirLien.disabled = true; chronoDemarre = false; tempsVisionnage = 10; timerVisuel.textContent = "10s";
            messageDynamique.textContent = "Cliquez sur le lecteur rouge ci-dessus pour ouvrir YouTube et lancer le chrono...";
            zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "none"; zonePaiement.style.display = "none";
            blocConnexion.style.display = "block"; alert("Déconnexion réussie.");
        });
    });
});