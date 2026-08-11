async function getEligibleOpportunities(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  // 1. Découverte dynamique des modules enregistrés (aucun nom codé en dur).
  const registeredModules = registry.entries();

  // 2. État courant de l'utilisateur pour chaque opportunité.
  const states = await repository.getUserOpportunityStates(userId);
  const { stateBySlug, stateByOpportunityId } = indexUserStates(states);

  const eligibleOpportunities = [];

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
      null;

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
      // Normaliser position : convertir en entier si possible, sinon null
      position:
        opportunity && opportunity.position !== undefined && opportunity.position !== null
          ? Number.isNaN(Number(opportunity.position))
            ? null
            : Number(opportunity.position)
          : null,
      // Exposer explicitement logo_url (null si absent)
      logo_url:
        opportunity && (opportunity.logo_url || opportunity.logoUrl)
          ? (opportunity.logo_url || opportunity.logoUrl)
          : null,
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

  // 🔒 VERROU : ne garder que le premier élément (opportunité prioritaire)
  return eligibleOpportunities.length > 0 ? [eligibleOpportunities[0]] : [];
}