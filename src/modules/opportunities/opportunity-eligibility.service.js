Parfait — je te donne un fichier prêt à coller dans  src/modules/opportunities/opportunity-eligibility.service.js , avec une logique robuste qui s’adapte au nom de la méthode d’accès aux états utilisateur (service ou repository). Tu pourras l’ajouter directement via l’éditeur GitHub ou Termux.

Fichier à créer : src/modules/opportunities/opportunity-eligibility.service.js
Colle exactement ce code :

 
// src/modules/opportunities/opportunity-eligibility.service.js
const eligibilityService = require('./opportunity-eligibility.service');
const opportunityService = require('./opportunities.service');

// tentative d'accès au service repository utilisateur (plusieurs signatures possibles)
let userOpportunitiesService;
try {
  userOpportunitiesService = require('../users/user-opportunities/user-opportunities.service');
} catch (e) {
  // si le service n'existe pas, on laissera tomber sur le repository plus bas
  userOpportunitiesService = null;
}

/**
 * Helper pour récupérer les états user_opportunity depuis le service ou le repo existant.
 * Essaie plusieurs noms de fonctions courants pour s'adapter au repo/service en place.
 */
async function _getUserStates(userId) {
  if (userOpportunitiesService) {
    if (typeof userOpportunitiesService.findByUserId === 'function') {
      return userOpportunitiesService.findByUserId(userId);
    }
    if (typeof userOpportunitiesService.getByUserId === 'function') {
      return userOpportunitiesService.getByUserId(userId);
    }
    if (typeof userOpportunitiesService.getUserOpportunityStates === 'function') {
      return userOpportunitiesService.getUserOpportunityStates(userId);
    }
  }

  // fallback: essayer le repository directement (nommage courant)
  try {
    const userOpportunityRepository = require('../users/user-opportunities/user-opportunities.repository');
    if (typeof userOpportunityRepository.findByUserId === 'function') {
      return userOpportunityRepository.findByUserId(userId);
    }
    if (typeof userOpportunityRepository.getByUserId === 'function') {
      return userOpportunityRepository.getByUserId(userId);
    }
  } catch (e) {
    // ignore, will throw below
  }

  throw new Error('Impossible de lire les états user_opportunity : adaptez les noms de fonctions dans le service/repository.');
}

/**
 * Règles d'éligibilité (Cahier des charges V10 - règles par défaut)
 * - On ne considère que les opportunités dont status === 'ACTIVE'
 * - Si l'utilisateur a un état final (COMPLETED / FAILED / SUSPENDED / NOT_AVAILABLE) pour une opportunité => non éligible
 * - Si aucun état n'existe pour l'utilisateur :
 *     - si opp.is_entry === true -> eligible (entrée du parcours)
 *     - sinon -> non éligible par défaut (on évite d'exposer toutes les opportunités non commencées)
 *
 * Retour : tableau d'opportunités (objets tels quels), éventuellement à enrichir si tu veux inclure le state.
 */
async function getEligibleOpportunities(userId) {
  try {
    if (!userId) throw new Error('userId requis');

    // 1) récupérer les opportunités actives via le service existant
    if (typeof opportunityService.getActiveOpportunities !== 'function') {
      throw new Error('opportunityService.getActiveOpportunities introuvable — adapte le call.');
    }
    const activeOpportunities = await opportunityService.getActiveOpportunities();

    // 2) récupérer les états utilisateur
    const userStates = await _getUserStates(userId) || [];

    // normaliser les états : index par opportunity id ou slug
    const stateByOppId = new Map();
    const stateBySlug = new Map();
    for (const s of userStates) {
      // propriétés communes : opportunity_id ou opportunityId ; slug possible
      if (s.opportunity_id) stateByOppId.set(String(s.opportunity_id), s);
      if (s.opportunityId) stateByOppId.set(String(s.opportunityId), s);
      if (s.slug) stateBySlug.set(String(s.slug), s);
    }

    const nonEligibleStatuses = new Set(['COMPLETED', 'FAILED', 'SUSPENDED', 'NOT_AVAILABLE']);

    const eligible = activeOpportunities.filter(opp => {
      // trouver l'état lié (par id ou par slug)
      const oppId = opp.id || opp.opportunity_id || opp.opportunityId;
      const slug = opp.slug;
      const state = (oppId && stateByOppId.get(String(oppId))) || (slug && stateBySlug.get(String(slug)));

      if (!state) {
        // si aucun état : par défaut on n'inclut que les entrées (is_entry) pour démarrer le parcours
        return !!opp.is_entry;
      }

      // si l'état est dans la liste non-eligible -> exclure
      if (state.status && nonEligibleStatuses.has(state.status)) return false;

      // sinon, considérer comme eligible (AVAILABLE, STARTED, PENDING sont éligibles)
      return true;
    });

    return eligible;
  } catch (error) {
    console.error('[opportunity-eligibility.service.getEligibleOpportunities]', error);
    throw error;
  }
}

module.exports = {
  getEligibleOpportunities,
};
 

Que faire ensuite (pas à pas)

Colle ce fichier dans  src/modules/opportunities/opportunity-eligibility.service.js .
Commit / push :
git add src/modules/opportunities/opportunity-eligibility.service.js
git commit -m "feat(opportunities): implement getEligibleOpportunities V10"
git push origin main

Tests

Si tu veux tester depuis ton navigateur, il faut être authentifié. Exemple curl (si tu as un token JWT) :
curl -H "Authorization: Bearer " https://point-focal.onrender.com/api/opportunities/eligible
Si tu n’as pas de token, appelle la route /api/opportunities/eligible depuis ton front après t’être logué, ou demande-moi comment générer un token de test si tu as un endpoint d’auth.

Si l’appel plante (erreur disant qu’il ne trouve pas la méthode getActiveOpportunities ou findByUserId)

Colle ici le début de ces fichiers pour que j’ajuste les noms :
src/modules/opportunities/opportunities.service.js (les premières ~40 lignes)
src/modules/users/user-opportunities/user-opportunities.service.js ou repository.js (les premières ~40 lignes)
Je l’adapterai immédiatement.

Souhaites‑tu que je prépare aussi le patch git (diff) prêt à coller sur GitHub, ou tu colles toi‑même le fichier ?