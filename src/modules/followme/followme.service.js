const followmeEngine = require("../../core/followme.engine");

async function getSponsorLinkForOpportunity(
  userId,
  opportunitySlug
) {
  return followmeEngine.getSponsorLinkForOpportunity(
    userId,
    opportunitySlug
  );
}

module.exports = { getSponsorLinkForOpportunity };
