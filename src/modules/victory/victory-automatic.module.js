/**
 * Module Victory Automatic
 * 
 * Opportunité d'entrée dans Point Focal.
 * Permet aux utilisateurs de s'inscrire via Victory Automatic.
 * 
 * Contrat avec le moteur générique :
 * - checkEligibility(userId, { state, opportunity }) : détermine si l'utilisateur
 *   est éligible pour cette opportunité
 */

const repository = require("./victory.repository");

/**
 * Vérifie l'éligibilité d'un utilisateur pour Victory Automatic.
 * 
 * Règles d'éligibilité :
 * - Victory Automatic est l'opportunité d'entrée => toujours éligible sauf si :
 *   - L'utilisateur a expiré et n'a pas été réactivé
 *   - L'utilisateur a déjà complété cette opportunité (vérifié par le moteur)
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {object} context - Contexte fourni par le moteur générique
 * @param {object|null} context.state - État actuel de l'utilisateur pour cette opportunité
 * @param {object|null} context.opportunity - Métadonnées de l'opportunité en base
 * @returns {Promise<{eligible: boolean, reason?: string, metadata?: object}>}
 */
async function checkEligibility(userId, { state, opportunity }) {
  if (!userId) {
    return {
      eligible: false,
      reason: "Utilisateur non authentifié.",
      metadata: {}
    };
  }

  try {
    // Récupération des données utilisateur
    const user = await repository.findUserWithSponsor(userId);

    if (!user) {
      return {
        eligible: false,
        reason: "Utilisateur introuvable.",
        metadata: {}
      };
    }

    // Vérification du statut expiré
    if (user.victory_expired === true || user.status === "expired") {
      return {
        eligible: false,
        reason: "Votre délai de 24 heures a expiré. Demandez une réactivation.",
        metadata: {
          expired: true,
          status: user.status
        }
      };
    }

    // Victory Automatic est l'opportunité d'entrée => éligible par défaut
    // Le moteur exclut déjà les opportunités complétées
    return {
      eligible: true,
      reason: null,
      metadata: {
        hasVictoryLink: Boolean(user.victory_personal_link),
        victoryStartedAt: user.victory_started_at,
        victoryExpiresAt: user.victory_expires_at,
        status: user.status
      }
    };
  } catch (error) {
    return {
      eligible: false,
      reason: `Erreur lors de la vérification d'éligibilité : ${error.message}`,
      metadata: { error: error.message }
    };
  }
}

module.exports = {
  // Métadonnées du module
  name: "Victory Automatic",
  slug: "victory-automatic",
  requiresLink: true,
  position: 1,
  description: "Opportunité d'entrée : inscription via Victory Automatic",

  // Méthode d'éligibilité (contrat avec le moteur générique)
  checkEligibility
};
