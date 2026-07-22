const victoryService = require("./victory.service");

async function assignVictoryLink(req, res) {
  try {
    const result = await victoryService.assignVictoryLink(
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Lien Victory attribué",
      url: result.url,
      startedAt: result.startedAt,
      expiresAt: result.expiresAt
    });

  } catch (err) {
    console.error(
      "========== VICTORY LINK ERROR =========="
    );

    console.error(err);

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "Erreur attribution lien Victory"
    });
  }
}

async function reactivateVictory(req, res) {
  try {
    const result =
      await victoryService.reactivateVictory(
        req.user.id
      );

    return res.status(200).json({
      success: true,
      message: result.message,
      startedAt: result.startedAt,
      expiresAt: result.expiresAt,
      status: result.status,
      victoryExpired: result.victoryExpired,
      linkActive: result.linkActive
    });

  } catch (err) {
    console.error(
      "======= VICTORY REACTIVATION ERROR ======="
    );

    console.error(err);

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "Erreur de réactivation"
    });
  }
}
async function saveVictoryPersonalLink(
  req,
  res
) {
  try {
    const {
      victoryPersonalLink
    } = req.body;

    const result =
      await victoryService.saveVictoryPersonalLink(
        req.user.id,
        victoryPersonalLink
      );

    return res.status(200).json({
      success: true,
      message:
        "Lien Victory enregistré avec succès.",
      data: result
    });

  } catch (err) {
    console.error(
      "======= SAVE VICTORY LINK ERROR ======="
    );

    console.error(err);

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "Erreur d'enregistrement."
    });
  }
}
module.exports = {
  assignVictoryLink,
  reactivateVictory,
  saveVictoryPersonalLink
};