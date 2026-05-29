document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. RÉCUPÉRATION DES ÉLÉMENTS DE L'INTERFACE
    // ==========================================
    const blocLangue = document.getElementById("bloc-langue");
    const blocInscription = document.getElementById("bloc-inscription");
    const blocConnexion = document.getElementById("bloc-connexion");
    const blocOublie = document.getElementById("bloc-oublie");
    
    const nomSponsor = document.getElementById("nom-sponsor");
    const insCodeInput = document.getElementById("ins-code");
    
    // Boutons de bascule d'affichage
    const versConnexion = document.getElementById("vers-connexion");
    const versInscription = document.getElementById("vers-inscription");
    const versOublie = document.getElementById("vers-oublie");
    const oublieRetour = document.getElementById("oublie-retour");

    // ==========================================
    // 2. GESTION DES BOUTONS DE LANGUE (ÉTAPE 0)
    // ==========================================
    const boutonsLangue = document.querySelectorAll(".btn-langue");
    
    boutonsLangue.forEach(bouton => {
        bouton.addEventListener("click", (e) => {
            // Récupère la langue stockée dans l'attribut data-lang (fr, en, pt, es)
            const langueChoisie = e.currentTarget.getAttribute("data-lang");
            console.log("Langue sélectionnée :", langueChoisie);

            // Extraction automatique du code parrain/sponsor depuis l'URL de la page (ex: ?ref=PSEUDO)
            const paramsURL = new URLSearchParams(window.location.search);
            let codeParrain = paramsURL.get("ref") || "LOBONGO1"; // Par défaut si l'URL est vide

            // Remplissage des zones de texte du sponsor
            if (nomSponsor) nomSponsor.innerText = codeParrain;
            if (insCodeInput) insCodeInput.value = codeParrain;

            // 🔴 CORRECTION : Masquer le choix de la langue et afficher le formulaire d'inscription
            if (blocLangue) blocLangue.style.display = "none";
            if (blocInscription) blocInscription.style.display = "block";

            // (Optionnel) Tu pourras appeler ta fonction de traduction ici :
            // appliquerTraduction(langueChoisie);
        });
    });

    // ==========================================
    // 3. GESTION DES BASCULES (S'inscrire / Se connecter)
    // ==========================================
    if (versConnexion) {
        versConnexion.addEventListener("click", () => {
            blocInscription.style.display = "none";
            blocConnexion.style.display = "block";
        });
    }

    if (versInscription) {
        versInscription.addEventListener("click", () => {
            blocConnexion.style.display = "none";
            blocInscription.style.display = "block";
        });
    }

    if (versOublie) {
        versOublie.addEventListener("click", () => {
            blocConnexion.style.display = "none";
            blocOublie.style.display = "block";
        });
    }

    if (oublieRetour) {
        oublieRetour.addEventListener("click", () => {
            blocOublie.style.display = "none";
            blocConnexion.style.display = "block";
        });
    }

    // ==========================================
    // 4. AFFICHER / MASQUER LES MOTS DE PASSE
    // ==========================================
    const checkboxesAfficher = document.querySelectorAll(".chk-afficher");
    checkboxesAfficher.forEach(chk => {
        chk.addEventListener("change", (e) => {
            const passFields = document.querySelectorAll(".pass-field");
            passFields.forEach(field => {
                field.type = e.target.checked ? "text" : "password";
            });
        });
    });

    // ==========================================
    // 5. BOUTONS DE DÉCONNEXION GENERALE
    // ==========================================
    const boutonsDeco = document.querySelectorAll(".btn-deco-global");
    boutonsDeco.forEach(btn => {
        btn.addEventListener("click", () => {
            // Recharger la page et revenir au choix de la langue
            window.location.reload();
        });
    });
});