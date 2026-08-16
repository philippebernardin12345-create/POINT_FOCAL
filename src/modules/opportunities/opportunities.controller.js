/**
 * POINT FOCAL V10.4 - Contrôleur Opportunités
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 4, 5, 6
 */

const opportunitiesService = require("./opportunities.service");
const { success, error, notFound, validationError } = require("../../utils/response");
const { logger } = require("../../utils/logger");

/**
 * Liste toutes les opportunités disponibles
 */
async function getAll(req, res) {
  try {
    const opportunities = await opportunitiesService.getAllOpportunities();

    return success(res, opportunities, "Opportunités récupérées avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur getAll:", error);
    return error(res, error.message || "Erreur lors de la récupération des opportunités");
  }
}

/**
 * Liste les opportunités actives
 */
async function getActive(req, res) {
  try {
    const opportunities = await opportunitiesService.getActiveOpportunities();

    return success(res, opportunities, "Opportunités actives récupérées avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur getActive:", error);
    return error(res, error.message || "Erreur lors de la récupération des opportunités actives");
  }
}

/**
 * Récupère l'opportunité d'entrée dynamique
 */
async function getEntry(req, res) {
  try {
    const userId = req.user.id;
    const opportunity = await opportunitiesService.getEntryOpportunity(userId);

    if (!opportunity) {
      return notFound(res, "Aucune opportunité d'entrée disponible");
    }

    return success(res, opportunity, "Opportunité d'entrée récupérée avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur getEntry:", error);
    return error(res, error.message || "Erreur lors de la récupération de l'opportunité d'entrée");
  }
}

/**
 * Récupère le générateur du lien PF dynamique
 */
async function getGenerator(req, res) {
  try {
    const userId = req.user.id;
    const generator = await opportunitiesService.getGeneratorOpportunity(userId);

    if (!generator) {
      return notFound(res, "Aucun générateur de lien PF disponible");
    }

    return success(res, generator, "Générateur de lien PF récupéré avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur getGenerator:", error);
    return error(res, error.message || "Erreur lors de la récupération du générateur");
  }
}

/**
 * Récupère la prochaine opportunité pour un utilisateur
 */
async function getNext(req, res) {
  try {
    const userId = req.user.id;
    const { currentOpportunityId } = req.query;

    if (!currentOpportunityId) {
      return validationError(res, "L'ID de l'opportunité actuelle est obligatoire");
    }

    const next = await opportunitiesService.getNextOpportunity(userId, currentOpportunityId);

    if (!next) {
      return notFound(res, "Aucune opportunité suivante disponible");
    }

    return success(res, next, "Prochaine opportunité récupérée avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur getNext:", error);
    return error(res, error.message || "Erreur lors de la récupération de la prochaine opportunité");
  }
}

/**
 * Récupère une opportunité par son slug
 */
async function getBySlug(req, res) {
  try {
    const { slug } = req.params;

    const opportunity = await opportunitiesService.getOpportunityBySlug(slug);

    if (!opportunity) {
      return notFound(res, "Opportunité introuvable");
    }

    return success(res, opportunity, "Opportunité récupérée avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur getBySlug:", error);
    return error(res, error.message || "Erreur lors de la récupération de l'opportunité");
  }
}

/**
 * Enregistre le lien Follow Me pour une opportunité
 */
async function registerFollowMeLink(req, res) {
  try {
    const userId = req.user.id;
    const { opportunityId, referralLink, targetAddress, paymentHash } = req.body;

    if (!opportunityId) {
      return validationError(res, "L'ID de l'opportunité est obligatoire");
    }

    if (!referralLink) {
      return validationError(res, "Le lien de parrainage est obligatoire");
    }

    const result = await opportunitiesService.registerFollowMeLink({
      userId,
      opportunityId,
      referralLink,
      targetAddress,
      paymentHash
    });

    return success(res, result, "Lien Follow Me enregistré avec succès");
  } catch (error) {
    logger.error("[Opportunities] Erreur registerFollowMeLink:", error);
    return error(res, error.message || "Erreur lors de l'enregistrement du lien");
  }
}

module.exports = {
  getAll,
  getActive,
  getEntry,
  getGenerator,
  getNext,
  getBySlug,
  registerFollowMeLink
};