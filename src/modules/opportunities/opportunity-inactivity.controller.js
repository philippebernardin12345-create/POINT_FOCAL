const inactivityService = require("../../core/opportunity-inactivity.service");
const { success, error, validationError } = require("../../utils/response");
const { logger } = require("../../utils/logger");

async function report(req, res) {
  try {
    const reporterUserId = req.user.id;
    const { opportunityId } = req.body || {};
    if (!opportunityId) return validationError(res, "L'ID de l'opportunité est obligatoire");

    const result = await inactivityService.reportAndVerify({ reporterUserId, opportunityId });
    const messages = {
      active: "Le compte destinataire est actif : le signalement est rejeté.",
      indeterminate: "L'état du compte destinataire est indéterminé : aucun FIFO 2 n'est déclenché.",
      confirmed: "L'inactivité du compte destinataire est confirmée dans cette opportunité."
    };
    return success(res, result, messages[result.result] || "Vérification terminée");
  } catch (err) {
    logger.error("[OpportunityInactivity] Erreur report:", err);
    return error(res, err.message || "Erreur lors de la vérification du lien attribué");
  }
}

module.exports = { report };
