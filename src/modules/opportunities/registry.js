/**
 * POINT FOCAL V10 - Registre des Modules d'Opportunité
 *
 * Permet d'enregistrer dynamiquement les opportunités
 * sans modifier le moteur central.
 */

class OpportunityRegistry {
  constructor() {
    this.modules = new Map();
  }

  /**
   * Enregistre un module d'opportunité.
   *
   * @param {string} slug - Identifiant unique du module
   * @param {object} moduleConfig - Configuration du module
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
   * Récupère un module par son slug.
   *
   * @param {string} slug
   * @returns {object|undefined}
   */
  get(slug) {
    return this.modules.get(slug);
  }

  /**
   * Retourne tous les modules enregistrés.
   *
   * @returns {Array<object>}
   */
  list() {
    return Array.from(this.modules.values());
  }

  /**
   * Retourne les modules avec leur slug.
   * Utilisé par le moteur générique pour parcourir
   * les opportunités sans connaître leurs noms à l'avance.
   *
   * @returns {Array<{slug: string, module: object}>}
   */
  entries() {
    return Array.from(this.modules.entries()).map(
      ([slug, module]) => ({
        slug,
        module
      })
    );
  }

  /**
   * Vérifie si un module est enregistré.
   *
   * @param {string} slug
   * @returns {boolean}
   */
  has(slug) {
    return this.modules.has(slug);
  }

  /**
   * Charge les opportunités actives depuis la base de données.
   *
   * Le repository doit fournir une méthode findAllActive()
   * retournant au minimum :
   * - id
   * - slug
   * - name
   * - requires_user_link
   * - position
   *
   * @param {object} opportunityRepository
   * @returns {Promise<Array<object>>}
   */
  async loadFromDatabase(opportunityRepository) {
    if (
      !opportunityRepository ||
      typeof opportunityRepository.findAllActive !== "function"
    ) {
      throw new Error(
        "Un repository d'opportunités valide est requis."
      );
    }

    try {
      const activeOpportunities =
        await opportunityRepository.findAllActive();

      activeOpportunities.forEach((opportunity) => {
        if (!this.has(opportunity.slug)) {
          this.register(opportunity.slug, {
            id: opportunity.id,
            name: opportunity.name,
            requiresLink: opportunity.requires_user_link,
            position: opportunity.position
          });
        }
      });

      console.log(
        `[Registry] ${this.modules.size} modules chargés depuis la DB.`
      );

      return this.list();
    } catch (error) {
      console.error(
        "[Registry] Erreur lors du chargement depuis la DB:",
        error
      );

      throw error;
    }
  }
}

module.exports = new OpportunityRegistry();
