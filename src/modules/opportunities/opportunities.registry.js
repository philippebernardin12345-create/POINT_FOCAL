/**
 * POINT FOCAL V10.4 - Registre des Modules d'Opportunité
 * 
 * Permet d'enregistrer dynamiquement les opportunités
 * sans modifier le moteur central.
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 29, 36
 */

class OpportunityRegistry {
  constructor() {
    this.modules = new Map();
  }

  /**
   * Enregistre un module d'opportunité
   */
  register(slug, moduleConfig) {
    if (!slug || typeof slug !== "string") {
      throw new Error("Le slug du module est obligatoire.");
    }

    if (!moduleConfig || typeof moduleConfig !== "object") {
      throw new Error(`La configuration du module "${slug}" est invalide.`);
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
   * Récupère un module par son ID
   */
  getById(id) {
    for (const [slug, module] of this.modules) {
      if (module.id === id) {
        return module;
      }
    }
    return null;
  }

  /**
   * Retourne tous les modules enregistrés
   */
  list() {
    return Array.from(this.modules.values());
  }

  /**
   * Retourne les modules avec leur slug
   */
  entries() {
    return Array.from(this.modules.entries()).map(([slug, module]) => ({
      slug,
      module
    }));
  }

  /**
   * Vérifie si un module est enregistré
   */
  has(slug) {
    return this.modules.has(slug);
  }

  /**
   * Recherche des modules par capacité
   */
  findByCapacity(capacity, value = true) {
    const results = [];

    for (const [slug, module] of this.modules) {
      if (module[capacity] === value) {
        results.push(module);
      }
    }

    return results;
  }


  /**
   * Charge les opportunités depuis la base de données
   */
  async loadFromDatabase(opportunityRepository) {
    if (!opportunityRepository || typeof opportunityRepository.findAllActive !== "function") {
      throw new Error("Un repository d'opportunités valide est requis.");
    }

    try {
      const activeOpportunities = await opportunityRepository.findAllActive();

      activeOpportunities.forEach((opportunity) => {
        if (!this.has(opportunity.slug)) {
          this.register(opportunity.slug, {
            id: opportunity.id,
            name: opportunity.name,
            description: opportunity.description,
            status: opportunity.status,
            isActive: String(opportunity.status).toUpperCase() === "ACTIVE",
            isAvailable: opportunity.is_available !== false,
            priority: opportunity.priority || 1,
            isEntry: opportunity.is_entry || false,
            canGeneratePointFocalLink: opportunity.generates_link === true,
            requiresProvision: opportunity.requires_provision || false,
            provisionAmount: opportunity.provision_amount || null,
            provisionMessage: opportunity.provision_message || null,
            registrationUrl: opportunity.registration_url || null,
            dependsOn: opportunity.depends_on || null,
            requiresUserLink: opportunity.requires_user_link !== false
          });
        }
      });

      console.log(`[Registry] ${this.modules.size} modules chargés depuis la DB.`);

      return this.list();
    } catch (error) {
      console.error("[Registry] Erreur lors du chargement depuis la DB:", error);
      throw error;
    }
  }
}

module.exports = new OpportunityRegistry();

