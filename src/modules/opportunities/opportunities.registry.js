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

  /**
   * Liste tous les modules enregistrés en conservant leur slug.
   * Utilisé par le moteur générique pour parcourir les modules
   * sans connaître leurs noms à l'avance.
   * @returns {Array<{ slug: string, module: object }>}
   */
  entries() {
    return Array.from(this.modules.entries()).map(
      ([slug, module]) => ({ slug, module })
    );
  }

  /**
   * Indique si un module est enregistré pour un slug donné
   */
  has(slug) {
    return this.modules.has(slug);
  }
}

module.exports = new OpportunityRegistry();

 

 
