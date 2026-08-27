/**
 * POINT FOCAL V10.4 - Service Opportunités
 *
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 4, 5, 6
 */

const registry = require("./opportunities.registry");
const {
  getEntryOpportunity: engineGetEntryOpportunity,
  getGeneratorOpportunity: engineGetGeneratorOpportunity,
  getNextOpportunity: engineGetNextOpportunity,
  getOpportunityBySlug: engineGetOpportunityBySlug,
  getOpportunityById: engineGetOpportunityById,
  getAvailableOpportunities
} = require("../../core/opportunity.engine");
const followmeEngine = require("../../core/followme.engine");
const { logger } = require("../../utils/logger");

/**
 * Récupère toutes les opportunités
 */
async function getAllOpportunities() {
  return registry.list();
}

/**
 * Récupère les opportunités actives
 */
async function getActiveOpportunities() {
  return getAvailableOpportunities();
}


/**
 * Enregistre le lien Follow Me pour une opportunité
 */
async function registerFollowMeLink({ userId, opportunityId, referralLink, targetAddress = null, paymentHash = null, sponsorId = null }) {
  try {
    // Vérifier que l'opportunité existe
    const opportunity = await engineGetOpportunityById(opportunityId);

    if (!opportunity) {
      throw new Error("Opportunité introuvable");
    }

    // Vérifier que l'opportunité est active
    if (opportunity.status !== "active" && opportunity.isActive !== true) {
      throw new Error("Opportunité non active");
    }

    // Enregistrer le lien via le service Follow Me
    const result = await followmeEngine.registerUserLink({
      userId,
      opportunityId,
      referralLink,
      targetAddress,
      paymentHash,
      sponsorId
    });

    return result;
  } catch (error) {
    logger.error("[OpportunitiesService] Erreur registerFollowMeLink:", error);
    throw error;
  }
}

/**
 * Vérifie si une opportunité peut générer le lien PF
 */
async function canGeneratePointFocalLink(opportunityId) {
  const opportunity = await engineGetOpportunityById(opportunityId);

  if (!opportunity) {
    return false;
  }

  return opportunity.canGeneratePointFocalLink === true;
}

/**
 * Récupère les exigences de provision d'une opportunité
 */
async function getProvisionRequirements(opportunityId) {
  const opportunity = await engineGetOpportunityById(opportunityId);

  if (!opportunity) {
    return { requires: false, amount: null, message: null };
  }

  return {
    requires: opportunity.requiresProvision === true,
    amount: opportunity.provisionAmount || null,
    message: opportunity.provisionMessage || null
  };
}

module.exports = {
  getAllOpportunities,
  getActiveOpportunities,
  getEntryOpportunity: engineGetEntryOpportunity,
  getGeneratorOpportunity: engineGetGeneratorOpportunity,
  getNextOpportunity: engineGetNextOpportunity,
  getOpportunityBySlug: engineGetOpportunityBySlug,
  registerFollowMeLink,
  canGeneratePointFocalLink,
  getProvisionRequirements
};