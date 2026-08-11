const repository = require("./opportunities.repository");
const registry = require("./opportunities.registry");

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR GÉNÉRIQUE DES OPPORTUNITÉS
//
// Ce moteur ne connaît AUCUNE opportunité en particulier (ni Victory Automatic,
// ni Victory World). Il découvre dynamiquement les modules enregistrés via le
// registry (Sprint 2) et interroge chaque module via un contrat standardisé.
// ─────────────────────────────────────────────────────────────────────────────

// États considérés comme « terminés » : l'opportunité correspondante n'est
// plus proposée à l'utilisateur car elle est déjà accomplie.
const COMPLETED_STATES = [
  "completed",
  "complete",
  "validated",
  "valid",
  "done",
  "finished",
];

/**
 * Normalise le résultat renvoyé par la méthode standardisée checkEligibility
 * d'un module. Un module peut renvoyer :
 *   - un booléen (true/false)
 *   - un objet { eligible: boolean, reason?: string, metadata?: object }
 * @returns {{ eligible: boolean, reason: string|null, metadata: object }}
 */
function normalizeEligibility(result) {
  if (result === true) {
    return { eligible: true, reason: null, metadata: {} };
  }

  if (result === false || result === null || result === undefined) {
    return { eligible: false, reason: null, metadata: {} };
  }

  if (typeof result === "object") {
    return {
      eligible: Boolean(result.eligible),
      reason: result.reason || null,
      metadata: result.metadata || {},
    };
  }

  return {
    eligible: false,
    reason: "Résultat d'éligibilité invalide.",
    metadata: {},
  };
}

/**
 * Indexe les états d'opportunité d'un utilisateur par slug et par id
 * d'opportunité, afin de retrouver rapidement l'état lié à un module donné.
 */
function indexUserStates(states) {
  const stateBySlug = new Map();
  const stateByOpportunityId = new Map();

  for (const row of states) {
    if (row.opportunity_slug) {
      stateBySlug.set(String(row.opportunity_slug), row);
    }

    if (row.opportunity_id !== null && row.opportunity_id !== undefined) {
      stateByOpportunityId.set(String(row.opportunity_id), row);
    }
  }

  return { stateBySlug, stateByOpportunityId };
}

/**
 * Retourne la liste des opportunités pour lesquelles l'utilisateur est éligible.
 *
 * Fonctionnement générique :
 *   1. Découverte dynamique des modules d'opportunité via le registry.
 *   2. Lecture de l'état courant de l'utilisateur dans user_opportunity_states.
 *   3. Pour chaque module, appel de la méthode standardisée checkEligibility()
 *      lorsqu'elle est définie (un module sans cette méthode est éligible par
 *      défaut, tant que l'opportunité n'est pas déjà terminée).
 *   4. Construction du résultat avec les métadonnées utiles (slug, nom, statut
 *      courant, position, etc.).
 *
 * @param {string|number} userId
 * @returns {Promise<Array<object>>}
 */
async function getEligibleOpportunities(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  // 1. Découverte dynamique des modules enregistrés (aucun nom codé en dur).
  const registeredModules = registry.entries();

  // 2. État courant de l'utilisateur pour chaque opportunité.
  const states = await repository.getUserOpportunityStates(userId);
  const { stateBySlug, stateByOpportunityId } = indexUserStates(states);

 ✋ const eligibleOpportunities = [];

  for (const { slug, module } of registeredModules) {
    // Métadonnées de l'opportunité en base (facultatif : le module peut exister
    // sans ligne correspondante dans la table opportunities).
    let opportunity = null;
    try {
      opportunity = await repository.findOpportunityBySlug(slug);
    } catch (_) {
      opportunity = null;
    }

    // Récupération de l'état de l'utilisateur pour ce module.
    const state =
      stateBySlug.get(String(slug)) ||
      (opportunity
        ? stateByOpportunityId.get(String(opportunity.id))
        : null) ||
      null;✋

    const currentStatus = state
      ? String(state.status || state.state || "").toLowerCase()
      : null;

    // Une opportunité déjà terminée n'est plus proposée.
    if (currentStatus && COMPLETED_STATES.includes(currentStatus)) {
      continue;
    }

    // 3. Contrat standardisé : le module décide de l'éligibilité s'il expose
    //    checkEligibility(). Sinon, il est éligible par défaut.
    let eligibility;

    if (module && typeof module.checkEligibility === "function") {
      try {
        eligibility = normalizeEligibility(
          await module.checkEligibility(userId, { state, opportunity })
        );
      } catch (error) {
        eligibility = {
          eligible: false,
          reason: error.message,
          metadata: {},
        };
      }
    } else {
      eligibility = { eligible: true, reason: null, metadata: {} };
    }

    if (!eligibility.eligible) {
      continue;
    }

    // 4. Construction de la réponse avec les métadonnées nécessaires.
    eligibleOpportunities.push({
      slug,
      name: (opportunity && opportunity.name) || module.name || slug,
      requiresLink:
        module.requiresLink !== undefined && module.requiresLink !== null
          ? Boolean(module.requiresLink)
          : Boolean(opportunity && opportunity.requires_user_link),
      opportunityId: opportunity ? opportunity.id : null,
      position: opportunity ? opportunity.position : null,
      currentStatus: currentStatus || "available",
      reason: eligibility.reason,
      metadata: {
        ...(module.metadata || {}),
        ...(eligibility.metadata || {}),
      },
    });
  }

  // Tri par position lorsqu'elle est disponible (parcours ordonné).
  eligibleOpportunities.sort((a, b) => {
    const positionA =
      a.position === null || a.position === undefined
        ? Number.MAX_SAFE_INTEGER
        : Number(a.position);
    const positionB =
      b.position === null || b.position === undefined
        ? Number.MAX_SAFE_INTEGER
        : Number(b.position);

    return positionA - positionB;
  });

  return eligibleOpportunities;
}

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
  getEligibleOpportunities,
  registerFollowMeLink
};