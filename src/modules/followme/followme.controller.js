const followmeService = require("./followme.service");

async function getSponsorLink(req, res) {
  try {
    const position = Number(req.params.position);

    const result =
      await followmeService.getSponsorLinkForOpportunity(
        req.user.id,
        position
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error(
      "========== FOLLOW ME ERROR =========="
    );
    console.error(err);

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "Erreur moteur Follow Me."
    });
  }
}

async function savePersonalLink(req, res) {
  try {
    const position = Number(req.params.position);
    const { referralLink } = req.body;

    const result =
      await followmeService.savePersonalOpportunityLink(
        req.user.id,
        position,
        referralLink
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error(
      "========== FOLLOW ME SAVE ERROR =========="
    );
    console.error(err);

    return res.status(400).json({
      success: false,
      message:
        err.message ||
        "Impossible d’enregistrer le lien personnel."
    });
  }
}

module.exports = {
  getSponsorLink,
  savePersonalLink
};
