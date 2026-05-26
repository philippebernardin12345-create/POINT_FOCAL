// app.js — Code Frontend pour ton application mobile

// Données fictives pour le test local (en attendant d'activer l'authentification)
const USER_ID_TEST = "00000000-0000-0000-0000-000000000000"; 
let tokenSessionTimer = null;

// Attendre que la page soit complètement chargée
document.addEventListener("DOMContentLoaded", () => {
    const btnRegarder = document.getElementById("btn-regarder");
    const btnObtenirLien = document.getElementById("btn-obtenir-lien");
    const zoneChrono = document.getElementById("zone-chrono");
    const zoneMessage = document.getElementById("zone-message");

    if (btnRegarder) {
        btnRegarder.addEventListener("click", async () => {
            // 1. Ouvrir la vidéo YouTube dans un nouvel onglet
            window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");

            // 2. Lancement visuel du chrono et des messages pédagogiques en local
            let tempsRestant = 180; // 3 minutes
            btnRegarder.disabled = true;
            zoneChrono.style.display = "block";

            const intervalle = setInterval(() => {
                tempsRestant--;
                zoneChrono.textContent = `${tempsRestant} secondes restantes`;

                // Gestion des messages pédagogiques dynamiques du cahier des charges
                if (tempsRestant > 150) {
                    zoneMessage.textContent = "« Regardez attentivement le début. L'algorithme YouTube détecte l'attention dès les premières secondes. »";
                } else if (tempsRestant > 120) {
                    zoneMessage.textContent = "« Pensez à LIKER la vidéo. Un like augmente sa visibilité de 30 %. »";
                } else if (tempsRestant > 90) {
                    zoneMessage.textContent = "« Vous êtes à la moitié. Continuez. Le visionnage complet est ce que YouTube récompense le plus. »";
                } else if (tempsRestant > 60) {
                    zoneMessage.textContent = "« Préparez un COMMENTAIRE AUTHENTIQUE. Pas 'nice video'. Donnez votre avis. YouTube valorise les vrais commentaires. »";
                } else if (tempsRestant > 30) {
                    zoneMessage.textContent = "« Encore une minute. Chaque seconde regardée augmente la portée de la vidéo... et donc de VOTRE futur lien. »";
                } else if (tempsRestant > 0) {
                    zoneMessage.textContent = "« Dernières secondes. Après cette étape, vous obtiendrez votre lien Victory Automatic. Merci pour votre engagement ! »";
                }

                // Fin du chrono
                if (tempsRestant <= 0) {
                    clearInterval(intervalle);
                    zoneChrono.textContent = "Terminé !";
                    zoneMessage.textContent = "« Félicitations ! Vous avez regardé jusqu'au bout. Vous venez de booster la vidéo. Maintenant, obtenez votre lien. »";
                    
                    // On débloque le bouton final
                    if (btnObtenirLien) {
                        btnObtenirLien.disabled = false;
                    }
                }
            }, 1000);
        });
    }
});