
const victoryService = require("./victory.service");

async function assignVictoryLink(req, res) {
  try {
    const result = await victoryService.assignVictoryLink(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Lien Victory attribué",
      url: result.url
    });

  } catch (err) {
    console.error("========== VICTORY LINK ERROR ==========");
    console.error(err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur attribution lien Victory"
    });
  }
}

module.exports = {
  assignVictoryLink
};