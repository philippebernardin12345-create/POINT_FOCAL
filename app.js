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
    const insCode = document.getElementById("ins-code");
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

    // Éléments Étape Visionnage
    const fausseVideoYt = document.getElementById("fausse-video-yt");

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
        errOublie.style.display = "none"; succesOublie.style.display = "none"; oubEmail.value = "";
    });
    document.getElementById("oublie-retour").addEventListener("click", () => {
        blocOublie.style.display = "none"; blocConnexion.style.display = "block";
    });

    // INSCRIPTION AVEC CODE D'INVITATION
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

    // ACTION LOGIQUE DE RÉCUPÉRATION DU MOT DE PASSE (CORRIGÉE)
    btnRecuperer.addEventListener("click", () => {
        errOublie.style.display = "none";
        succesOublie.style.display = "none";

        const emailSaisi = oubEmail.value.trim();

        if (emailSaisi === "" || !emailSaisi.includes("@")) {
            errOublie.textContent = "Veuillez entrer une adresse e-mail valide.";
            errOublie.style.display = "block";
            return;
        }

        // Simulation de la validation et envoi
        btnRecuperer.disabled = true;
        btnRecuperer.textContent = "Génération du lien de secours...";

        setTimeout(() => {
            btnRecuperer.disabled = false;
            btnRecuperer.textContent = "Récupérer mon mot de passe";
            succesOublie.textContent = "Un e-mail de réinitialisation a été envoyé à " + emailSaisi + " (Vérifiez vos spams).";
            succesOublie.style.display = "block";
            oubEmail.value = "";
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

    // INTERACTION POPUP -> AFFICHAGE DE LA ZONE DE FLUX VIDÉO
    btnRegarder.addEventListener("click", () => {
        popup.style.display = "none"; 
        zoneWorkflow.style.display = "block";
    });

    // CLIC LECTEUR -> LANCE YOUTUBE EXTERNE + CHRONO INTERNE EN PARALLÈLE
    let chronoDemarre = false;
    fausseVideoYt.addEventListener("click", () => {
        window.open("https://youtu.be/9uPybhkqYw4", "_blank");

        if (!chronoDemarre) {
            chronoDemarre = true;
            // CHRONO DE TEST À 3s (PASSE À 180 POUR LA PRODUCTION)
            let tempsVisionnage = 3; 
            timerVisuel.textContent = `${tempsVisionnage}s`;
            messageDynamique.textContent = "« Interagissez sur YouTube (Like, Commentaire) pendant la validation de sécurité... »";

            const intervalleVisionnage = setInterval(() => {
                tempsVisionnage--; 
                timerVisuel.textContent = `${tempsVisionnage}s`;

                if (tempsVisionnage <= 0) {
                    clearInterval(intervalleVisionnage);
                    messageDynamique.textContent = "« Visionnage validé ! Récupérez votre premier lien ci-dessous. »";
                    btnObtenirLien.disabled = false;
                }
            }, 1000);
        }
    });

    // ÉTAPE 4 : CLIC LIEN MLM (OPPORTUNITÉ 1)
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

        zoneLiaisonMlm.style.display = "none";
        zonePaiement.style.display = "block";
    });

    // ÉTAPE 6 : OUVRIR TON LIEN OPPORTUNITÉ 2
    btnOuvrirOpportunite2.addEventListener("click", () => {
        window.open("https://victoryworld.club/longa01", "_blank");
    });

    // ACTION DE VÉRIFICATION DU PAIEMENT RÉSEAU
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
            alert("Succès ! Inscription validée.\n\nVotre licence Point Focal V3 is active !");
        }, 2000);
    });

    // LOGIQUE DE DECONNEXION GLOBALISEE
    btnDeconnexion.forEach(btn => {
        btn.addEventListener("click", () => {
            insCode.value = "ABCD1000"; insEmail.value = ""; insPass.value = ""; insConf.value = "";
            conEmail.value = ""; conPass.value = ""; oubEmail.value = "";
            mlmAdresseCible.value = ""; cryptoTxid.value = ""; btnObtenirLien.disabled = true;
            chronoDemarre = false;
            zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "none"; zonePaiement.style.display = "none";
            blocConnexion.style.display = "block"; alert("Déconnexion réussie.");
        });
    });
});