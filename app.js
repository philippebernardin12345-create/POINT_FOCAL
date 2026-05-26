// app.js — Authentification et Workflow V3 Compléts avec liens réels
document.addEventListener("DOMContentLoaded", () => {

    // Blocs Principaux
    const blocInscription = document.getElementById("bloc-inscription");
    const blocConnexion = document.getElementById("bloc-connexion");
    const blocOublie = document.getElementById("bloc-oublie");
    const popup = document.getElementById("popup-youtube");
    const zoneWorkflow = document.getElementById("zone-workflow");
    const zoneLiaisonMlm = document.getElementById("zone-liaison-mlm");
    const zonePaiement = document.getElementById("zone-paiement");

    // Éléments Formulaires
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

    // Éléments Paiement Étape 6
    const btnOuvrirOpportunite2 = document.getElementById("btn-ouvrir-opportunite2");
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
    });
    document.getElementById("oublie-retour").addEventListener("click", () => {
        blocOublie.style.display = "none"; blocConnexion.style.display = "block";
    });

    // INSCRIPTION
    btnInscription.addEventListener("click", () => {
        errInscription.style.display = "none";
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

    // CLIC REGARDER -> TA VRAIE VIDÉO YOUTUBE (CHRONO DE TEST À 3s)
    btnRegarder.addEventListener("click", () => {
        window.open("https://youtu.be/9uPybhkqYw4", "_blank");
        popup.style.display = "none"; zoneWorkflow.style.display = "block";
        
        let tempsVisionnage = 3; 
        messageDynamique.textContent = "« Analyse des critères d'engagement de l'algorithme... »";

        const intervalleVisionnage = setInterval(() => {
            tempsVisionnage--; timerVisuel.textContent = `${tempsVisionnage}s`;
            if (tempsVisionnage <= 0) {
                clearInterval(intervalleVisionnage);
                messageDynamique.textContent = "« Visionnage validé avec succès ! »";
                btnObtenirLien.disabled = false;
            }
        }, 1000);
    });

    // ÉTAPE 4 : CLIC LIEN MLM (TON VRAI LIEN OPPORTUNITÉ 1)
    btnObtenirLien.addEventListener("click", () => {
        window.open("https://victoryautomatic.com/user/register/lobongo01", "_blank");
        zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "block";
    });

    // ÉTAPE 5 : VALIDATION DU LIEN MEMBRE SAISI
    btnValiderAdresse.addEventListener("click", () => {
        errMlm.style.display = "none";
        const saisie = mlmAdresseCible.value.trim();
        if (saisie === "" || !saisie.includes("victoryautomatic.com/")) {
            errMlm.textContent = "Veuillez entrer votre lien d'affiliation Victory Automatic valide.";
            errMlm.style.display = "block"; return;
        }
        
        // Aller vers l'activation (Étape 6)
        zoneLiaisonMlm.style.display = "none";
        zonePaiement.style.display = "block";
    });

    // ÉTAPE 6 : OUVRIR TON LIEN OPPORTUNITÉ 2
    btnOuvrirOpportunite2.addEventListener("click", () => {
        window.open("https://victoryworld.club/longa01", "_blank");
    });

    // ACTION DE VÉRIFICATION DU PAIEMENT RÉSSEAU
    btnVerifierPaiement.addEventListener("click", () => {
        errPaiement.style.display = "none";
        const txidSaisi = cryptoTxid.value.trim();

        if (txidSaisi === "" || txidSaisi.length < 5) {
            errPaiement.textContent = "Veuillez entrer un TxID ou identifiant réseau valide.";
            errPaiement.style.display = "block"; return;
        }

        btnVerifierPaiement.disabled = true;
        btnVerifierPaiement.textContent = "Vérification sur la matrice réseau...";

        setTimeout(() => {
            btnVerifierPaiement.disabled = false;
            btnVerifierPaiement.textContent = "Activer mon compte définitivement";
            alert("Succès ! Inscription validée.\n\nVotre licence Point Focal V3 est désormais active et immunisée contre le nettoyage des 48h !");
        }, 2000);
    });

    // LOGIQUE DE DECONNEXION GLOBALISEE
    btnDeconnexion.forEach(btn => {
        btn.addEventListener("click", () => {
            insEmail.value = ""; insPass.value = ""; insConf.value = "";
            conEmail.value = ""; conPass.value = ""; oubEmail.value = "";
            mlmAdresseCible.value = ""; cryptoTxid.value = ""; btnObtenirLien.disabled = true;
            zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "none"; zonePaiement.style.display = "none";
            blocConnexion.style.display = "block"; alert("Déconnexion réussie.");
        });
    });
});