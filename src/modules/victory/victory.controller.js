const response = require("../../core/response");
const victoryService = require("./victory.service");

async function assignVictoryLink(req, res) {
  try {
    const result = await victoryService.assignVictoryLink(req.user.id);
    return response.success(res, result, "Lien Victory attribué", 200);
  } catch (err) {
    console.error("========== VICTORY LINK ERROR ==========");
    console.error(err);
    return response.error(res, err.message || "Erreur attribution lien Victory", 400);
  }
}

module.exports = {
  assignVictoryLink
};
