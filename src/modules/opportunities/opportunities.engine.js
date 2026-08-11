
 
const repository = require("./opportunities.repository");
const registry = require("./opportunities.registry");

const COMPLETED_STATES = ["completed", "complete", "validated", "valid", "done", "finished"];

function normalizeEligibility(result) {
  if (result === true) return { eligible: true, reason: null, metadata: {} };
  if (!result) return { eligible: false, reason: null, metadata: {} };
  if (typeof result === "object") {
    return {
      eligible: Boolean(result.eligible),
      reason: result.reason || null,
      metadata: result.metadata || {},
    };
  }
  return { eligible: false, reason: "Résultat invalide", metadata: {} };
}

function indexUserStates(states) {
  const stateBySlug = new Map();
  const stateByOpportunityId = new Map();
  for (const row of states) {
    if (row.opportunity_slug) stateBySlug.set(String(row.opportunity_slug), row);
    if (row.opportunity_id) stateByOpportunityId.set(String(row.opportunity_id), row);
  }
  return { stateBySlug, stateByOpportunityId };
}

async function getEligibleOpportunities(userId) {
  if (!userId) throw new Error("Utilisateur non authentifié.");
  const registeredModules = registry.entries();
  const states = await repository.getUserOpportunityStates(userId);
  const { stateBySlug, stateByOpportunityId } = indexUserStates(states);

  const eligibleOpportunities = [];

  for (const { slug, module } of registeredModules) {
    let opportunity = await repository.findOpportunityBySlug(slug).catch(() => null);
    const state = stateBySlug.get(String(slug)) || (opportunity ? stateByOpportunityId.get(String(opportunity.id)) : null);
    const currentStatus = state ? String(state.status || state.state || "").toLowerCase() : null;

    if (currentStatus && COMPLETED_STATES.includes(currentStatus)) continue;

    let eligibility = module && typeof module.checkEligibility === "function"
      ? normalizeEligibility(await module.checkEligibility(userId, { state, opportunity }))
      : { eligible: true, reason: null, metadata: {} };

    if (!eligibility.eligible) continue;

    eligibleOpportunities.push({
      slug,
      name: (opportunity && opportunity.name) || module.name || slug,
      requiresLink: Boolean(opportunity && opportunity.requires_user_link),
      opportunityId: opportunity ? opportunity.id : null,
      position: opportunity ? Number(opportunity.position) : null,
      logo_url: null, // Décision : Pas de logos pour l'instant
      currentStatus: currentStatus || "available",
      reason: eligibility.reason,
      metadata: { ...(module.metadata || {}), ...(eligibility.metadata || {}) },
    });
  }

  eligibleOpportunities.sort((a, b) => (a.position || 999) - (b.position || 999));

  // OPTION 2 : Une seule carte à la fois
  return eligibleOpportunities.length > 0 ? [eligibleOpportunities[0]] : [];
}

async function registerFollowMeLink({ userId, opportunityId, assignedSponsorLink, personalLink, realParentLink }) {
  const cleanPersonal = String(personalLink || "").trim().toLowerCase();
  const cleanParent = String(realParentLink || "").trim().toLowerCase();

  if (!/^[a-z0-9_-]{3,}$/.test(cleanPersonal)) {
    throw new Error("Lien invalide : utilisez lettres, chiffres, - ou _ (min 3 car.).");
  }

  if (cleanPersonal === cleanParent) throw new Error("Le lien ne peut pas être identique au parrain.");

  const parentExists = await repository.findAssignmentByPersonalLink(opportunityId, cleanParent);
  if (!parentExists) throw new Error("Le parrain est introuvable dans le système.");

  try {
    return await repository.createAssignment({
      userId, opportunityId, personalLink: cleanPersonal,
      realParentLink: cleanParent, assignedSponsorLink: cleanParent,
      assignmentSource: "follow_me"
    });
  } catch (err) {
    if (err.code === '23505' || err.message.includes('unique constraint')) {
      throw new Error("Ce lien est déjà utilisé par un autre membre.");
    }
    throw err;
  }
}

module.exports = { getEligibleOpportunities, registerFollowMeLink };

 

 





