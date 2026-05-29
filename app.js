document.addEventListener("DOMContentLoaded", () => {
    // 1. Éléments des blocs d'affichage
    const blocLangue = document.getElementById("bloc-langue");
    const blocInscription = document.getElementById("bloc-inscription");
    const blocConnexion = document.getElementById("bloc-connexion");
    const zoneWorkflow = document.getElementById("zone-workflow");

    // 2. Éléments du formulaire d'inscription
    const insEmail = document.getElementById("ins-email");
    const insPass = document.getElementById("ins-pass");
    const insConf = document.getElementById("ins-conf");
    const btnInscription = document.getElementById("btn-inscription");
    const erreurInscription = document.getElementById("erreur-inscription");
    
    const nomSponsor = document.getElementById("nom-sponsor");
    const insCodeInput = document.getElementById("ins-code");

    // 3. Choix de la langue (Bascule Étape 0 -> Étape 1)
    const boutonsLangue = document.querySelectorAll(".btn-langue");
    boutonsLangue.forEach(bouton => {
        bouton.addEventListener("click", (e) => {
            const paramsURL = new URLSearchParams(window.location.search);
            let codeParrain = paramsURL.get("ref") || "LOBONGO1";

            if (nomSponsor) nomSponsor.innerText = codeParrain;
            if (insCodeInput) insCodeInput.value = codeParrain;

            if (blocLangue) blocLangue.style.display = "none";
            if (blocInscription) blocInscription.style.display = "block";
        });
    });

    // 🔴 CORRECTION DU BOUTON S'INSCRIRE (Début du formulaire Point Focal)
    if (btnInscription) {
        btnInscription.addEventListener("click", (e) => {
            e.preventDefault(); // Empêche tout rechargement de page anormal
            
            // On cache l'erreur par défaut
            erreurInscription.style.display = "none";
            erreurInscription.innerText = "";

            // Vérification 1 : Les champs sont-ils vides ?
            if (!insEmail.value.trim() || !insPass.value.trim() || !insConf.value.trim()) {
                erreurInscription.innerText = "Veuillez remplir tous les champs.";
                erreurInscription.style.display = "block";
                return;
            }

            // Vérification 2 : Les mots de passe sont-ils identiques ?
            if (insPass.value !== insConf.value) {
                erreurInscription.innerText = "Les mots de passe ne correspondent pas.";
                erreurInscription.style.display = "block";
                return;
            }

            // Si tout est correct, on passe à la suite
            console.log("Inscription réussie pour :", insEmail.value);
            
            // Masquer le formulaire d'inscription et afficher la zone vidéo (Workflow)
            if (blocInscription) blocInscription.style.display = "none";
            if (zoneWorkflow) {
                zoneWorkflow.style.display = "block";
                demarrerTimerVideo(); // Lance le décompte de la vidéo
            }
        });
    }

    // Fonction pour gérer le compte à rebours de la vidéo
    function demarrerTimerVideo() {
        const timerVisuel = document.getElementById("timer-visuel");
        const btnObtenirLien = document.getElementById("btn-obtenir-lien");
        const msgDynamique = document.getElementById("message-dynamique");
        let temps = 10;

        if (timerVisuel) {
            const interval = setInterval(() => {
                temps--;
                timerVisuel.innerText = temps + "s";
                if (msgDynamique) msgDynamique.innerText = "Analyse du visionnage en cours...";

                if (temps <= 0) {
                    clearInterval(interval);
                    timerVisuel.innerText = "Prêt !";
                    if (msgDynamique) msgDynamique.innerText = "Vidéo validée. Vous pouvez récupérer votre lien.";
                    if (btnObtenirLien) btnObtenirLien.removeAttribute("disabled");
                }
            }, 1000);
        }
    }

    // Liens de bascule Connexion / Inscription
    const versConnexion = document.getElementById("vers-connexion");
    const versInscription = document.getElementById("vers-inscription");

    if (versConnexion) {
        versConnexion.addEventListener("click", () => {
            if (blocInscription) blocInscription.style.display = "none";
            if (blocConnexion) blocConnexion.style.display = "block";
        });
    }
    if (versInscription) {
        versInscription.addEventListener("click", () => {
            if (blocConnexion) blocConnexion.style.display = "none";
            if (blocInscription) blocInscription.style.display = "block";
        });
    }

    // Afficher/Masquer le mot de passe
    const checkboxesAfficher = document.querySelectorAll(".chk-afficher");
    checkboxesAfficher.forEach(chk => {
        chk.addEventListener("change", (e) => {
            const passFields = document.querySelectorAll(".pass-field");
            passFields.forEach(field => {
                field.type = e.target.checked ? "text" : "password";
            });
        });
    });

    // Déconnexion
    const boutonsDeco = document.querySelectorAll(".btn-deco-global");
    boutonsDeco.forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.reload();
        });
    });
});