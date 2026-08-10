// src/modules/opportunities/opportunity-eligibility.service.js

// Ne pas require ce fichier lui-même (éviter require circulaire)
// Récupérer directement le repository des opportunités pour éviter les boucles
let opportunitiesRepository;
try {
  opportunitiesRepository = require('./opportunities.repository');
} catch (e) {
  opportunitiesRepository = null;
}

// tentative d'accès au service/repo utilisateur (plusieurs signatures possibles)
let userOpportunitiesService;
try {
  userOpportunitiesService = require('../users/user-opportunities/user-opportunities.service');
} catch (e) {
  userOpportunitiesService = null;
}

async function _getActiveOpportunities() {
  if (opportunitiesRepository) {
    if (typeof opportunitiesRepository.findAllActive === 'function') return opportunitiesRepository.findAllActive();
    if (typeof opportunitiesRepository.getActive === 'function') return opportunitiesRepository.getActive();
    if (typeof opportunitiesRepository.findActive === 'function') return opportunitiesRepository.findActive();
  }
  throw new Error("Impossible d'obtenir les opportunités actives : adapte le repository (findAllActive/getActive).");
}

/**
* Helper pour récupérer les états user_opportunity depuis le service ou le repo existant.
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
    if (typeof userOpportunityRepository.findByUserId === 'function') return userOpportunityRepository.findByUserId(userId);
    if (typeof userOpportunityRepository.getByUserId === 'function') return userOpportunityRepository.getByUserId(userId);
  } catch (e) {
    // ignore, will throw below
  }

  throw new Error('Impossible de lire les états user_opportunity : adapte les noms de fonctions dans le service/repository.');
}

/**
* getEligibleOpportunities(userId)
* - Filtre uniquement les opportunités actives (via repository)
* - Exclut celles pour lesquelles l'utilisateur a un état final (COMPLETED, FAILED, SUSPENDED, NOT_AVAILABLE)
* - Si aucun état pour l'utilisateur : n'inclut que les opportunités d\'entrée (is_entry === true)
*/
async function getEligibleOpportunities(userId) {
  try {
    if (!userId) throw new Error('userId requis');

    const activeOpportunities = await _getActiveOpportunities();
    const userStates = await _getUserStates(userId) || [];

    const stateByOppId = new Map();
    const stateBySlug = new Map();
    for (const s of userStates) {
      if (s.opportunity_id) stateByOppId.set(String(s.opportunity_id), s);
      if (s.opportunityId) stateByOppId.set(String(s.opportunityId), s);
      if (s.slug) stateBySlug.set(String(s.slug), s);
    }

    const nonEligibleStatuses = new Set(['COMPLETED', 'FAILED', 'SUSPENDED', 'NOT_AVAILABLE']);

    const eligible = activeOpportunities.filter(opp => {
      const oppId = opp.id || opp.opportunity_id || opp.opportunityId;
      const slug = opp.slug;
      const state = (oppId && stateByOppId.get(String(oppId))) || (slug && stateBySlug.get(String(slug)));

      if (!state) {
        return !!opp.is_entry;
      }

      if (state.status && nonEligibleStatuses.has(state.status)) return false;
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
 

Étapes suivantes (une par une)

Sauvegarde ce fichier (si tu l'as déjà créé, remplace le contenu par celui-ci).

Commit & push :
git add src/modules/opportunities/opportunity-eligibility.service.js
git commit -m "feat(opportunities): implement getEligibleOpportunities V10 (repository-based)"
git push origin main

Intégration dans opportunities.service.js

Ajoute (si pas déjà) dans opportunities.service.js :

 
const eligibilityService = require('./opportunity-eligibility.service');

async function getEligibleOpportunities(userId) {
  return eligibilityService.getEligibleOpportunities(userId);
}

module.exports = {
  // ... autres exports ...
  getEligibleOpportunities,
};
 


