
const followmeService = require("./followme.service");

async function getSponsorLink(req, res) {
  try {
    const position = Number(
      req.params.position
    );

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

module.exports = {
  getSponsorLink
};