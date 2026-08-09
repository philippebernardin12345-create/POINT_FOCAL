class OpportunityRegistry {
  constructor() {
    this.modules = new Map();
  }

  /**
   * Enregistre un module d'opportunité
   * @param {string} slug - ex: 'victory-automatic'
   * @param {object} config - Configuration et routes du module
   */
  register(slug, moduleConfig) {
    this.modules.set(slug, moduleConfig);
    console.log(`[Registry] Module '${slug}' enregistré avec succès.`);
  }

  /**
   * Récupère un module par son slug
   */
  get(slug) {
    return this.modules.get(slug);
  }

  /**
   * Liste tous les modules actifs
   */
  list() {
    return Array.from(this.modules.values());
  }
}

module.exports = new OpportunityRegistry();

 

 
