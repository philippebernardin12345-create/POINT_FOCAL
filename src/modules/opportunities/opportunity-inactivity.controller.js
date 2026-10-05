const inactivityService = require("../../core/opportunity-inactivity.service");
const { success, error, validationError } = require("../../utils/response");
const { logger } = require("../../utils/logger");

async function report(req, res) {
  try {
    const userId = req.user.id;
    const { opportunityId } = req.body || {};

    if (!opportunityId) {
      return validationError(res, "L'ID de l'opportunité est obligatoire");
    }

    const result = await inactivityService.reportAndVerify({
      userId,
      opportunityId
    });

    const messages = {
      active: "Le lien est actif : le signalement d'inactivité est rejeté.",
      indeterminate: "L'état du lien est indéterminé : aucun FIFO 2 n'est déclenché.",
      confirmed: "L'inactivité est confirmée pour cette opportunité."
    };

    return success(res, result, messages[result.result] || "Vérification terminée");
  } catch (err) {
    logger.error("[OpportunityInactivity] Erreur report:", err);
    return error(res, err.message || "Erreur lors de la vérification du lien");
  }
}

module.exports = { report };
