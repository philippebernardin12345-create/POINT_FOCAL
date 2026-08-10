/**
* POINT FOCAL V10 - Registre des Modules d'Opportunité
* Permet d'enregistrer dynamiquement des opportunités sans modifier le moteur central.
*/

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
    if (!slug || typeof slug !== "string") {
      throw new Error("Le slug du module est obligatoire.");
    }

    if (!moduleConfig || typeof moduleConfig !== "object") {
      throw new Error(
        `La configuration du module "${slug}" est invalide.`
      );
    }

    this.modules.set(slug, {
      slug,
      ...moduleConfig
    });

    console.log(`[Registry] Module "${slug}" enregistré.`);
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

  /**
   * Charge les modules d'opportunité depuis la base de données.
   * Exige un repository avec la méthode findAllActive() qui renvoie
   * les opportunités actives (status = 'ACTIVE') avec au minimum
   * les champs : id, slug, name, requires_user_link, position.
   */
  async loadFromDatabase(opportunityRepository) {
    if (!opportunityRepository || typeof opportunityRepository.findAllActive !== "function") {
      throw new Error("Un repository d'opportunités valide est requis.");
    }

    try {
      const activeOps = await opportunityRepository.findAllActive();

      activeOps.forEach((op) => {
        if (!this.has(op.slug)) {
          this.register(op.slug, {
            id: op.id,
            name: op.name,
            requiresLink: op.requires_user_link,
            position: op.position
          });
        }
      });

      console.log(`[Registry] ${this.modules.size} modules chargés depuis la DB.`);
      return this.list();
    } catch (err) {
      console.error("[Registry] Erreur lors du chargement depuis la DB:", err);
      throw err;
    }
  }
}

module.exports = new OpportunityRegistry();
