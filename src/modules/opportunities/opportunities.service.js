const opportunityRepository = require(
  "./opportunities.repository"
);

const opportunityEngine = require(
  "./opportunities.engine"
);

async function getActiveOpportunities() {
  return opportunityRepository.findAllActive();
}

async function getActiveEntryOpportunity() {
  return opportunityRepository.getActiveEntryOpportunity();
}

async function getAllOpportunities() {
  return opportunityRepository.findAll();
}

async function getOpportunityById(id) {
  return opportunityRepository.findById(id);
}

async function getOpportunityBySlug(slug) {
  const normalizedSlug = String(slug || "")
    .trim()
    .toLowerCase();

  if (!normalizedSlug) {
    throw new Error(
      "Identifiant de l'opportunité manquant."
    );
  }

  const opportunity =
    await opportunityRepository.findOpportunityBySlug(
      normalizedSlug
    );

  if (!opportunity) {
    throw new Error(
      "Opportunité introuvable."
    );
  }

  return opportunity;
}

async function getNextOpportunity(
  currentPosition
) {
  const opportunities =
    await opportunityRepository.findAllActive();

  return (
    opportunities.find(
      (opportunity) =>
        Number(opportunity.position) >
        Number(currentPosition)
    ) || null
  );
}

async function registerFollowMeLink({
  userId,
  opportunityId,
  assignedSponsorLink,
  personalLink,
  realParentLink
}) {
  const opportunity =
    await opportunityRepository.findById(
      opportunityId
    );

  if (!opportunity) {
    throw new Error(
      "Opportunité introuvable."
    );
  }

  if (opportunity.active === false) {
    throw new Error(
      "Cette opportunité est désactivée."
    );
  }

  if (
    opportunity.requires_user_link === false
  ) {
    throw new Error(
      "Cette opportunité ne demande pas de lien personnel."
    );
  }

  return opportunityEngine.registerFollowMeLink({
    userId,
    opportunityId,
    assignedSponsorLink,
    personalLink,
    realParentLink
  });
}

module.exports = {
  getActiveOpportunities,
  getActiveEntryOpportunity,
  getAllOpportunities,
  getOpportunityById,
  getOpportunityBySlug,
  getNextOpportunity,
  registerFollowMeLink
};
