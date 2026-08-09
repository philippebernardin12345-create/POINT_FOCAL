/**
 * Module Victory World
 * 
 * Deuxième opportunité dans Point Focal.
 * Nécessite la validation de Victory Automatic avant d'être accessible.
 * 
 * Contrat avec le moteur générique :
 * - checkEligibility(userId, { state, opportunity }) : détermine si l'utilisateur
 *   est éligible pour cette opportunité
 */

const repository = require("./victory-world.repository");

/**
 * Vérifie l'éligibilité d'un utilisateur pour Victory World.
 * 
 * Règles d'éligibilité :
 * - L'utilisateur doit avoir un lien Victory personnel validé (Victory Automatic complété)
 * - Le statut Victory Automatic ne doit pas être "expired"
 * - Victory World nécessite Victory Automatic comme prérequis
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
    const user = await repository.findUserById(userId);

    if (!user) {
      return {
        eligible: false,
        reason: "Utilisateur introuvable.",
        metadata: {}
      };
    }

    // Vérification du prérequis : Victory Automatic doit être complété
    // (l'utilisateur doit avoir un lien Victory personnel validé)
    if (!user.victory_personal_link) {
      return {
        eligible: false,
        reason: "Vous devez d'abord compléter Victory Automatic.",
        metadata: {
          requiresVictoryAutomatic: true,
          hasVictoryPersonalLink: false
        }
      };
    }

    // Vérification du statut expiré pour Victory Automatic
    if (user.victory_expired === true || user.status === "expired") {
      return {
        eligible: false,
        reason: "Votre compte Victory Automatic a expiré. Demandez une réactivation.",
        metadata: {
          expired: true,
          status: user.status
        }
      };
    }

    // L'utilisateur a complété Victory Automatic => éligible pour Victory World
    // Le moteur exclut déjà les opportunités Victory World déjà complétées
    return {
      eligible: true,
      reason: null,
      metadata: {
        hasVictoryWorldLink: Boolean(user.victory_world_link),
        victoryWorldStatus: user.victory_world_status || "not_started",
        victoryWorldStartedAt: user.victory_world_started_at,
        victoryPersonalLink: user.victory_personal_link,
        victoryAutomaticCompleted: true
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
  name: "Victory World",
  slug: "victory-world",
  requiresLink: true,
  position: 2,
  description: "Deuxième opportunité : inscription via Victory World (nécessite Victory Automatic)",

  // Méthode d'éligibilité (contrat avec le moteur générique)
  checkEligibility
};
