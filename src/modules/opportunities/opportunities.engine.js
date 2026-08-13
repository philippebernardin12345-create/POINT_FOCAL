/**
 * src/modules/opportunities/opportunities.engine.js
 *
 * Moteur générique d'éligibilité des opportunités.
 * Ajout de logs de debug pour tracer pourquoi une opportunité est exclue.
 */

const repository = require("./opportunities.repository");
const registry = require("./opportunities.registry");

const COMPLETED_STATES = ["completed", "complete", "validated", "valid", "done", "finished"];

/**
 * Normalise le résultat de checkEligibility pour un format standard.
 */
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

/**
 * Indexe les états utilisateur retournés par le repo pour accès rapide.
 */
function indexUserStates(states) {
  const stateBySlug = new Map();
  const stateByOpportunityId = new Map();
  for (const row of states || []) {
    if (row.opportunity_slug) stateBySlug.set(String(row.opportunity_slug), row);
    if (row.opportunity_id) stateByOpportunityId.set(String(row.opportunity_id), row);
  }
  return { stateBySlug, stateByOpportunityId };
}

/**
 * Récupère la liste des opportunités éligibles pour un utilisateur donné.
 *
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function getEligibleOpportunities(userId) {
  if (!userId) throw new Error("Utilisateur non authentifié.");

  // Modules enregistrés (slug + module)
  const registeredModules = registry.entries();
  console.log('[debug] registeredModules count:', registeredModules.length, 'slugs:', registeredModules.map(e => e.slug));

  // États utilisateur pour opportunités
  const states = await repository.getUserOpportunityStates(userId);
  console.log('[debug] user states count:', (states && states.length) || 0, 'states sample:', (states || []).slice(0,5));
  const { stateBySlug, stateByOpportunityId } = indexUserStates(states);

  const eligibleOpportunities = [];

  for (const { slug, module } of registeredModules) {
    // Récupère l'enregistrement d'opportunité depuis la DB si disponible
    let opportunity = await repository.findOpportunityBySlug(slug).catch(() => null);

    const state = stateBySlug.get(String(slug)) || (opportunity ? stateByOpportunityId.get(String(opportunity.id)) : null);
    const currentStatus = state ? String(state.status || state.state || "").toLowerCase() : null;

    console.log('[debug] module check start', { slug, hasOpportunity: !!opportunity, opportunityId: opportunity ? opportunity.id : null, state, currentStatus });

    // Ignorer les opportunités déjà terminées
    if (currentStatus && COMPLETED_STATES.includes(currentStatus)) {
      console.log('[debug] excluded', { slug, reason: 'completed_status', currentStatus });
      continue;
    }

    // Calcul de l'éligibilité via le module (s'il expose la fonction)
    let rawEligibility;
    if (module && typeof module.checkEligibility === "function") {
      try {
        rawEligibility = await module.checkEligibility(userId, { state, opportunity, repository, registry });
      } catch (err) {
        console.log('[debug] checkEligibility error', { slug, error: err && err.message ? err.message : err });
        // En cas d'erreur d'exécution, considérer comme non éligible et propager la raison
        rawEligibility = { eligible: false, reason: "exception_dans_checkEligibility", metadata: { error: err && err.message ? err.message : String(err) } };
      }
    } else {
      // Par défaut si aucun module ou fonction, considérer non éligible
      rawEligibility = false;
    }

    const eligibility = normalizeEligibility(rawEligibility);
    console.log('[debug] eligibility result', { slug, eligibility });

    if (!eligibility.eligible) {
      console.log('[debug] excluded', { slug, reason: eligibility.reason, metadata: eligibility.metadata });
      continue;
    }

    // Si éligible, assembler l'objet d'opportunité à renvoyer
    if (opportunity) {
      // On peut enrichir l'objet renvoyé si besoin (metadata, module info...)
      const result = {
        id: opportunity.id,
        name: opportunity.name,
        slug: opportunity.slug,
        status: opportunity.status || opportunity.state || "ACTIVE",
        requires_user_link: opportunity.requires_user_link,
        position: opportunity.position,
        metadata: eligibility.metadata || {},
      };
      eligibleOpportunities.push(result);
    } else {
      // Module présent mais pas d'enregistrement DB - renvoyer une forme minimale
      eligibleOpportunities.push({
        id: null,
        name: module && module.name ? module.name : slug,
        slug,
        status: "UNKNOWN",
        metadata: eligibility.metadata || {},
        _note: "module_without_db_record"
      });
    }
  }

  return eligibleOpportunities;
}

module.exports = {
  getEligibleOpportunities,
  // export utile pour tests unitaires
  normalizeEligibility,
  indexUserStates,
};