/**
 * POINT FOCAL V10.4 - Moteur d'opportunités
 * 
 * Cœur du système de sélection et gestion des opportunités.
 * Indépendant de toute opportunité particulière.
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 4, 5, 6, 30
 */

const registry = require("../modules/opportunities/registry");
const { findUserById } = require("../modules/users/users.repository");

/**
 * Sélectionne l'opportunité d'entrée disponible
 * 
 * Règle : Recherche parmi les opportunités :
 * - actives
 * - disponibles
 * - autorisées comme opportunité d'entrée (isEntry = true)
 * - classées par priorité
 * 
 * @param {Object} context - Contexte de l'utilisateur (optionnel)
 * @param {string|number} context.userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Opportunité sélectionnée ou null
 */
async function getEntryOpportunity(context = {}) {
  try {
    // Récupérer toutes les opportunités enregistrées
    const allOpportunities = registry.list();

    // Filtrer : actives, disponibles, isEntry = true
    const eligible = allOpportunities.filter(opp => {
      const isActive = opp.status === 'active' || opp.isActive === true;
      const isAvailable = opp.isAvailable !== false;
      const isEntry = opp.isEntry === true;

      return isActive && isAvailable && isEntry;
    });

    // Trier par priorité (plus petit = plus prioritaire)
    eligible.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // Retourner la première opportunité trouvée
    return eligible[0] || null;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getEntryOpportunity:', error);
    return null;
  }
}

/**
 * Sélectionne l'opportunité capable de générer le lien POINT FOCAL
 * 
 * Règle : Recherche parmi les opportunités :
 * - actives
 * - disponibles
 * - canGeneratePointFocalLink = true
 * - classées par priorité
 * 
 * @param {Object} context - Contexte de l'utilisateur (optionnel)
 * @returns {Promise<Object|null>} - Générateur sélectionné ou null
 */
async function getGeneratorOpportunity(context = {}) {
  try {
    const allOpportunities = registry.list();

    // Filtrer : actives, disponibles, canGeneratePointFocalLink = true
    const eligible = allOpportunities.filter(opp => {
      const isActive = opp.status === 'active' || opp.isActive === true;
      const isAvailable = opp.isAvailable !== false;
      const canGenerate = opp.canGeneratePointFocalLink === true;

      return isActive && isAvailable && canGenerate;
    });

    // Trier par priorité
    eligible.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    return eligible[0] || null;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getGeneratorOpportunity:', error);
    return null;
  }
}

/**
 * Sélectionne la prochaine opportunité pour un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} currentOpportunityId - ID de l'opportunité actuelle
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Object|null>} - Prochaine opportunité ou null
 */
async function getNextOpportunity(userId, currentOpportunityId, options = {}) {
  try {
    // Récupérer l'utilisateur
    const user = await findUserById(userId);

    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    // Récupérer toutes les opportunités
    const allOpportunities = registry.list();

    // Filtrer : actives, disponibles
    const available = allOpportunities.filter(opp => {
      const isActive = opp.status === 'active' || opp.isActive === true;
      const isAvailable = opp.isAvailable !== false;

      return isActive && isAvailable;
    });

    // Trier par priorité
    available.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // Trouver l'index de l'opportunité actuelle
    const currentIndex = available.findIndex(opp => opp.id === currentOpportunityId);

    if (currentIndex === -1) {
      // Si l'opportunité actuelle n'est pas trouvée, retourner la première disponible
      return available[0] || null;
    }

    // Retourner l'opportunité suivante (ou null si c'était la dernière)
    return available[currentIndex + 1] || null;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getNextOpportunity:', error);
    return null;
  }
}

/**
 * Vérifie si une opportunité est disponible
 * 
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<boolean>} - True si disponible
 */
async function isOpportunityAvailable(opportunityId) {
  try {
    const opp = registry.getById(opportunityId);

    if (!opp) {
      return false;
    }

    const isActive = opp.status === 'active' || opp.isActive === true;
    const isAvailable = opp.isAvailable !== false;

    return isActive && isAvailable;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur isOpportunityAvailable:', error);
    return false;
  }
}

/**
 * Récupère une opportunité par son slug
 * 
 * @param {string} slug - Slug de l'opportunité
 * @returns {Object|null} - Opportunité trouvée ou null
 */
function getOpportunityBySlug(slug) {
  try {
    const allOpportunities = registry.list();

    return allOpportunities.find(opp => opp.slug === slug) || null;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getOpportunityBySlug:', error);
    return null;
  }
}

/**
 * Récupère une opportunité par son ID
 * 
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Object|null} - Opportunité trouvée ou null
 */
function getOpportunityById(opportunityId) {
  try {
    return registry.getById(opportunityId) || null;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getOpportunityById:', error);
    return null;
  }
}

/**
 * Recherche des opportunités par capacité
 * 
 * @param {string} capacity - Nom de la capacité (ex: 'canGeneratePointFocalLink')
 * @param {boolean} value - Valeur attendue (défaut: true)
 * @returns {Array} - Liste des opportunités correspondantes
 */
function findOpportunitiesByCapacity(capacity, value = true) {
  try {
    const allOpportunities = registry.list();

    return allOpportunities.filter(opp => {
      return opp[capacity] === value;
    });

  } catch (error) {
    console.error('[OpportunityEngine] Erreur findOpportunitiesByCapacity:', error);
    return [];
  }
}

/**
 * Vérifie si une opportunité peut générer le lien POINT FOCAL
 * 
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {boolean} - True si l'opportunité peut générer le lien
 */
function canGeneratePointFocalLink(opportunityId) {
  try {
    const opp = registry.get(opportunityId);

    if (!opp) {
      return false;
    }

    return opp.canGeneratePointFocalLink === true;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur canGeneratePointFocalLink:', error);
    return false;
  }
}

/**
 * Vérifie si une opportunité nécessite une provision
 * 
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Object} - { requires: boolean, amount: number|null, message: string|null }
 */
function getProvisionRequirements(opportunityId) {
  try {
    const opp = registry.get(opportunityId);

    if (!opp) {
      return { requires: false, amount: null, message: null };
    }

    return {
      requires: opp.requiresProvision === true,
      amount: opp.provisionAmount || null,
      message: opp.provisionMessage || null
    };

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getProvisionRequirements:', error);
    return { requires: false, amount: null, message: null };
  }
}

/**
 * Compte les opportunités actives
 * 
 * @returns {number} - Nombre d'opportunités actives
 */
function countActiveOpportunities() {
  try {
    const allOpportunities = registry.list();

    return allOpportunities.filter(opp => {
      const isActive = opp.status === 'active' || opp.isActive === true;
      const isAvailable = opp.isAvailable !== false;

      return isActive && isAvailable;
    }).length;

  } catch (error) {
    console.error('[OpportunityEngine] Erreur countActiveOpportunities:', error);
    return 0;
  }
}

/**
 * Récupère toutes les opportunités disponibles
 * 
 * @param {Object} filters - Filtres optionnels
 * @param {boolean} filters.includeInactive - Inclure les opportunités inactives
 * @param {boolean} filters.includeUnavailable - Inclure les opportunités non disponibles
 * @returns {Array} - Liste des opportunités
 */
function getAvailableOpportunities(filters = {}) {
  try {
    const allOpportunities = registry.list();

    return allOpportunities.filter(opp => {
      const isActive = opp.status === 'active' || opp.isActive === true;
      const isAvailable = opp.isAvailable !== false;

      if (!filters.includeInactive && !isActive) {
        return false;
      }

      if (!filters.includeUnavailable && !isAvailable) {
        return false;
      }

      return true;
    });

  } catch (error) {
    console.error('[OpportunityEngine] Erreur getAvailableOpportunities:', error);
    return [];
  }
}

module.exports = {
  getEntryOpportunity,
  getGeneratorOpportunity,
  getNextOpportunity,
  isOpportunityAvailable,
  getOpportunityBySlug,
  getOpportunityById,
  findOpportunitiesByCapacity,
  canGeneratePointFocalLink,
  getProvisionRequirements,
  countActiveOpportunities,
  getAvailableOpportunities
};