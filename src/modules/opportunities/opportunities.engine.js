const repository = require("./opportunities.repository");

async function validateFollowMeLink({
  opportunityId,
  personalLink,
  realParentLink
}) {
  const parentAssignment =
    await repository.findAssignmentByPersonalLink(
      opportunityId,
      realParentLink
    );

  if (!parentAssignment) {
    throw new Error(
      "Lien refusé : le parrain n'existe pas dans la base."
    );
  }

  const existingLink =
    await repository.findAssignmentByPersonalLink(
      opportunityId,
      personalLink
    );

  if (existingLink) {
    throw new Error(
      "Ce lien existe déjà."
    );
  }

  return {
    valid: true
  };
}

module.exports = {
  validateFollowMeLink
};

