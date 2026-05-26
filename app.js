// app.js — Authentification et Workflow V3 Compléts

document.addEventListener("DOMContentLoaded", () => {
    // Blocs Principaux
    const blocInscription = document.getElementById("bloc-inscription");
    const blocConnexion = document.getElementById("bloc-connexion");
    const blocOublie = document.getElementById("bloc-oublie");
    const popup = document.getElementById("popup-youtube");
    const zoneWorkflow = document.getElementById("zone-workflow");
    const zoneLiaisonMlm = document.getElementById("zone-liaison-mlm");

    // Éléments Inscription / Connexion
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

    // -------------------------------------------------------------
    // GESTION AFFICHAGE / MASQUAGE DES MOTS DE PASSE
    // -------------------------------------------------------------
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
        blocInscription.style.display = "none";
        popup.style.display = "flex"; lancerChronoPopup();
    });

    // CONNEXION
    btnConnexion.addEventListener("click", () => {
        errConnexion.style.display = "none";
        if (conEmail.value === "" || conPass.value === "") {
            errConnexion.textContent = "Veuillez remplir l'e-mail et le mot de passe.";
            errConnexion.style.display = "block"; return;
        }
        blocConnexion.style.display = "none";
        popup.style.display = "flex"; lancerChronoPopup();
    });

    // RECUPÉRATION
    btnRecuperer.addEventListener("click", () => {
        errOublie.style.display = "none";
        if (oubEmail.value === "") {
            errOublie.textContent = "Veuillez entrer votre adresse e-mail.";
            errOublie.style.display = "block"; return;
        }
        alert(`E-mail de récupération envoyé à : ${oubEmail.value}`);
        blocOublie.style.display = "none"; blocConnexion.style.display = "block";
    });

    // CHRONO POPUP 10S
    function lancerChronoPopup() {
        let tempsLecture = 10;
        chronoLecture.style.display = "block";
        btnRegarder.disabled = true;
        chronoLecture.textContent = tempsLecture;
        const intervallePopup = setInterval(() => {
            tempsLecture--; chronoLecture.textContent = tempsLecture;
            if (tempsLecture <= 0) {
                clearInterval(intervallePopup);
                chronoLecture.style.display = "none"; btnRegarder.disabled = false;
            }
        }, 1000);
    }

    // CLIC REGARDER -> CHRONO 180S
    btnRegarder.addEventListener("click", () => {
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
        popup.style.display = "none"; zoneWorkflow.style.display = "block";

        let tempsVisionnage = 180;
        messageDynamique.textContent = "« Regardez attentivement le début. L'algorithme YouTube détecte l'attention dès les premières secondes. »";

        const intervalleVisionnage = setInterval(() => {
            tempsVisionnage--; timerVisuel.textContent = `${tempsVisionnage}s`;

            if (tempsVisionnage <= 150 && tempsVisionnage > 120) {
                messageDynamique.textContent = "« Pensez à LIKER la vidéo. Un like augmente sa visibilité de 30 %. »";
            } else if (tempsVisionnage <= 120 && tempsVisionnage > 90) {
                messageDynamique.textContent = "« Vous êtes à la moitié. Continuez. Le visionnage complet est ce que YouTube récompense le plus. »";
            } else if (tempsVisionnage <= 90 && tempsVisionnage > 60) {
                messageDynamique.textContent = "« Préparez un COMMENTAIRE AUTHENTIQUE. Pas 'nice video'. Donnez votre avis. YouTube valorise les vrais commentaires. »";
            } else if (tempsVisionnage <= 60 && tempsVisionnage > 30) {
                messageDynamique.textContent = "« Encore une minute. Chaque seconde regardée augmente la portée de la vidéo... et donc de VOTRE futur lien. »";
            } else if (tempsVisionnage <= 30 && tempsVisionnage > 0) {
                messageDynamique.textContent = "« Dernières secondes. Après cette étape, vous obtiendrez votre lien Victory Automatic. Merci pour votre engagement ! »";
            }

            if (tempsVisionnage <= 0) {
                clearInterval(intervalleVisionnage);
                messageDynamique.textContent = "« Visionnage validé ! »";
                btnObtenirLien.disabled = false;
            }
        }, 1000);
    });

    // -------------------------------------------------------------
    // ÉTAPE 4 : FIN DU CHRONO -> CLIC POUR OUVRIR LE MLM DU PARRAIN
    // -------------------------------------------------------------
    btnObtenirLien.addEventListener("click", () => {
        // 1. Ouverture obligatoire du lien d'inscription Victory Automatic racine (du parrain)
        window.open("https://victoryautomatic.com/ref=ABCD1000", "_blank");

        // 2. Bascule automatique de l'interface vers le champ de saisie d'adresse (Étape 5)
        zoneWorkflow.style.display = "none";
        zoneLiaisonMlm.style.display = "block";
    });

    // -------------------------------------------------------------
    // ÉTAPE 5 : VALIDATION DU LIEN MLM SAISI
    // -------------------------------------------------------------
    btnValiderAdresse.addEventListener("click", () => {
        errMlm.style.display = "none";
        const saisie = mlmAdresseCible.value.trim();

        // Validation stricte du format (Doit être un lien Victory valide pour correspondre au cahier des charges)
        if (saisie === "" || !saisie.includes("victoryautomatic.com/ref=")) {
            errMlm.textContent = "Veuillez entrer un lien d'affiliation Victory Automatic valide.";
            errMlm.style.display = "block";
            return;
        }

        // Succès -> Prochaine étape logique (La page de paiement)
        alert("Lien enregistré avec succès en base de données.\n\nChargement de la page de validation de paiement Blockchain (2.03 USDT)...");
    });

    // LOGIQUE DE DECONNEXION GLOBALISEE
    btnDeconnexion.forEach(btn => {
        btn.addEventListener("click", () => {
            insEmail.value = ""; insPass.value = ""; insConf.value = "";
            conEmail.value = ""; conPass.value = ""; oubEmail.value = "";
            mlmAdresseCible.value = ""; btnObtenirLien.disabled = true;
            zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "none";
            blocConnexion.style.display = "block";
            alert("Déconnexion réussie.");
        });
    });
});