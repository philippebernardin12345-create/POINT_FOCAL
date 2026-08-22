const followmeService = require("./followme.service");
const followmeEngine = require("../../core/followme.engine");
const rollupService = require("../../core/rollup.service");

async function getSponsorLink(req, res) {
  try {
    const { opportunitySlug } = req.params;

    const result = await followmeService.getSponsorLinkForOpportunity(
      req.user.id,
      opportunitySlug
    );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("[FollowMe] getSponsorLink:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur moteur Follow Me."
    });
  }
}

async function registerLink(req, res) {
  try {
    const {
      opportunityId,
      referralLink,
      targetAddress,
      paymentHash,
      sponsorId
    } = req.body;

    const result = await followmeEngine.registerUserLink({
      userId: req.user.id,
      opportunityId,
      referralLink,
      targetAddress,
      paymentHash,
      sponsorId
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error("[FollowMe] registerLink:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur lors de l'enregistrement du lien."
    });
  }
}

async function getUserLinks(req, res) {
  try {
    const result = await followmeEngine.getUserLinks(req.user.id);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("[FollowMe] getUserLinks:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur lors de la récupération des liens."
    });
  }
}

async function getAvailableLink(req, res) {
  try {
    const { opportunityId } = req.params;

    const result = await followmeEngine.getAvailableLink(
      opportunityId,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("[FollowMe] getAvailableLink:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur lors de la récupération du lien disponible."
    });
  }
}

async function checkOpportunity(req, res) {
  try {
    const { opportunityId } = req.params;

    const joined = await rollupService.hasUserJoinedOpportunity(
      req.user.id,
      opportunityId
    );

    return res.status(200).json({
      success: true,
      joined
    });
  } catch (err) {
    console.error("[FollowMe] checkOpportunity:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur lors de la vérification de l'opportunité."
    });
  }
}

async function applyRollup(req, res) {
  try {
    const { opportunityId } = req.body;

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: "opportunityId est obligatoire."
      });
    }

    const result = await rollupService.applyRollup(
      req.user.id,
      opportunityId
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("[FollowMe] applyRollup:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur lors de l'application du roll-up."
    });
  }
}

async function getRollupHistory(req, res) {
  try {
    const result = await rollupService.getRollupHistory(req.user.id);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("[FollowMe] getRollupHistory:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Erreur lors de la récupération de l'historique."
    });
  }
}

module.exports = {
  getSponsorLink,
  registerLink,
  getUserLinks,
  getAvailableLink,
  checkOpportunity,
  applyRollup,
  getRollupHistory
};
