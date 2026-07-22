const repository = require("./opportunities.repository");

function normalizeLink(link) {
  return String(link || "")
    .trim()
    .replace(/\/+$/, "");
}

async function registerFollowMeLink({
  userId,
  opportunityId,
  assignedSponsorLink,
  personalLink,
  realParentLink
}) {
  const normalizedPersonalLink =
    normalizeLink(personalLink);

  const normalizedParentLink =
    normalizeLink(realParentLink);

  const normalizedAssignedLink =
    normalizeLink(assignedSponsorLink);

  if (!userId || !opportunityId) {
    throw new Error(
      "Utilisateur ou opportunité manquant."
    );
  }

  if (!normalizedPersonalLink) {
    throw new Error(
      "Le lien personnel est obligatoire."
    );
  }

  if (!normalizedParentLink) {
    throw new Error(
      "Le lien du parrain est obligatoire."
    );
  }

  const existingAssignment =
    await repository.findAssignmentByUser(
      userId,
      opportunityId
    );

  if (existingAssignment) {
    throw new Error(
      "Vous avez déjà enregistré un lien pour cette opportunité."
    );
  }

  const parentAssignment =
    await repository.findAssignmentByPersonalLink(
      opportunityId,
      normalizedParentLink
    );

  if (!parentAssignment) {
    throw new Error(
      "Lien refusé : le parrain n'est pas encore présent dans la base Follow Me."
    );
  }

  const existingPersonalLink =
    await repository.findAssignmentByPersonalLink(
      opportunityId,
      normalizedPersonalLink
    );

  if (existingPersonalLink) {
    throw new Error(
      "Ce lien personnel est déjà enregistré."
    );
  }

  if (
    normalizedPersonalLink ===
    normalizedParentLink
  ) {
    throw new Error(
      "Le lien personnel ne peut pas être identique au lien du parrain."
    );
  }

  return repository.createAssignment({
    userId,
    opportunityId,
    assignedSponsorLink:
      normalizedAssignedLink ||
      normalizedParentLink,
    personalLink: normalizedPersonalLink,
    realParentLink: normalizedParentLink,
    assignmentSource: "follow_me"
  });
}

module.exports = {
  registerFollowMeLink
};