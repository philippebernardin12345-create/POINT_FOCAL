const repository = require(
  "./victory.repository"
);

const opportunityService = require(
  "../opportunities/opportunities.service"
);

function normalizeVictoryLink(victoryLink) {
  return String(victoryLink || "")
    .trim()
    .replace(/\/+$/, "");
}

function extractVictoryIdentifier(victoryLink) {
  let parsedUrl;

  try {
    parsedUrl = new URL(
      normalizeVictoryLink(victoryLink)
    );
  } catch {
    throw new Error(
      "Lien Victory Automatic invalide."
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname.toLowerCase() !==
      "victoryautomatic.com"
  ) {
    throw new Error(
      "Le lien Victory Automatic utilise un domaine invalide."
    );
  }

  const parts = parsedUrl.pathname
    .split("/")
    .filter(Boolean);

  if (
    parts.length !== 3 ||
    parts[0] !== "user" ||
    parts[1] !== "register"
  ) {
    throw new Error(
      "Le lien Victory Automatic ne respecte pas le format attendu."
    );
  }

  const identifier =
    decodeURIComponent(parts[2]).trim();

  if (!identifier) {
    throw new Error(
      "Identifiant Victory introuvable."
    );
  }

  if (
    !/^[a-zA-Z0-9._-]+$/.test(
      identifier
    )
  ) {
    throw new Error(
      "Identifiant Victory invalide."
    );
  }

  return identifier;
}

function buildVictoryLink(identifier) {
  const normalizedIdentifier =
    String(identifier || "").trim();

  if (!normalizedIdentifier) {
    throw new Error(
      "Identifiant du parrain Victory manquant."
    );
  }

  return (
    "https://victoryautomatic.com/user/register/" +
    encodeURIComponent(normalizedIdentifier)
  );
}

async function assignVictoryLink(userId) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const userWithSponsor =
    await repository.findUserWithSponsor(
      userId
    );

  if (!userWithSponsor) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (
    userWithSponsor.victory_expired === true ||
    userWithSponsor.status === "expired"
  ) {
    throw new Error(
      "Votre délai de 24 heures a expiré. Demandez une réactivation."
    );
  }

  let assignedVictoryLink = null;
  let assignedSponsorUserId = null;
  let source = null;

  /*
    PRIORITÉ 1 :
    lien Victory Automatic du parrain réel.
  */
  if (
    userWithSponsor.sponsor_user_id &&
    userWithSponsor.sponsor_victory_link
  ) {
    assignedVictoryLink =
      userWithSponsor.sponsor_victory_link;

    assignedSponsorUserId =
      userWithSponsor.sponsor_user_id;

    source = "sponsor";
  }

  /*
    PRIORITÉ 2 :
    rotation FIFO si le parrain réel
    n'a aucun lien Victory disponible.
  */
  if (!assignedVictoryLink) {
    const fifoSponsor =
      await repository
        .findOldestAvailableVictorySponsor(
          userWithSponsor.sponsor_user_id ||
            null
        );

    if (
      fifoSponsor &&
      fifoSponsor.victory_personal_link
    ) {
      assignedVictoryLink =
        fifoSponsor.victory_personal_link;

      assignedSponsorUserId =
        fifoSponsor.id;

      source = "fifo";
    }
  }

  /*
    PRIORITÉ 3 :
    lien Victory du compte racine.
  */
  if (!assignedVictoryLink) {
    const rootUser =
      await repository.findRootVictoryLink();

    if (
      rootUser &&
      rootUser.victory_personal_link
    ) {
      assignedVictoryLink =
        rootUser.victory_personal_link;

      assignedSponsorUserId =
        rootUser.id || null;

      source = "root-user";
    }
  }

  /*
    PRIORITÉ 4 :
    lien racine enregistré dans opportunities.
  */
  if (!assignedVictoryLink) {
    const rootOpportunity =
      await repository
        .findVictoryOpportunityRootLink();

    if (
      rootOpportunity &&
      rootOpportunity.root_sponsor_link
    ) {
      assignedVictoryLink =
        rootOpportunity.root_sponsor_link;

      source = "root-opportunity";
    }
  }

  if (!assignedVictoryLink) {
    throw new Error(
      "Aucun lien Victory Automatic disponible."
    );
  }

  const victoryParentIdentifier =
    extractVictoryIdentifier(
      assignedVictoryLink
    );

  const savedParentIdentifier =
    await repository
      .saveVictoryParentIdentifier(
        userId,
        victoryParentIdentifier
      );

  if (!savedParentIdentifier) {
    throw new Error(
      "Impossible d’enregistrer l’identifiant Victory du parrain."
    );
  }

  const now = new Date();

  const expiresAt = new Date(
    now.getTime() +
      24 * 60 * 60 * 1000
  );

  const assignedUser =
    await repository.markVictoryAssigned(
      userId,
      now,
      expiresAt
    );

  if (!assignedUser) {
    throw new Error(
      "Impossible d’attribuer le lien Victory Automatic."
    );
  }

  return {
    url: normalizeVictoryLink(
      assignedVictoryLink
    ),

    source,

    sponsorUserId:
      assignedSponsorUserId,

    victoryParentIdentifier,

    startedAt:
      assignedUser.victory_started_at,

    expiresAt:
      assignedUser.victory_expires_at
  };
}

async function saveVictoryPersonalLink(
  userId,
  victoryPersonalLink
) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const normalizedPersonalLink =
    normalizeVictoryLink(
      victoryPersonalLink
    );

  /*
    Vérifie le domaine, le chemin et
    l’identifiant du lien personnel.
  */
  extractVictoryIdentifier(
    normalizedPersonalLink
  );

  const user =
    await repository.findUserWithSponsor(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (
    user.victory_expired === true ||
    user.status === "expired"
  ) {
    throw new Error(
      "Votre délai de 24 heures a expiré. Demandez une réactivation."
    );
  }

  if (!user.victory_started_at) {
    throw new Error(
      "Aucun lien Victory Automatic ne vous a encore été attribué."
    );
  }

  if (
    user.victory_expires_at &&
    new Date(user.victory_expires_at) <
      new Date()
  ) {
    throw new Error(
      "Votre délai de 24 heures a expiré. Demandez une réactivation."
    );
  }

  if (user.victory_personal_link) {
    throw new Error(
      "Votre lien Victory Automatic est déjà enregistré."
    );
  }

  const duplicateLink =
    await repository
      .findUserByVictoryPersonalLink(
        normalizedPersonalLink
      );

  if (
    duplicateLink &&
    duplicateLink.id !== userId
  ) {
    throw new Error(
      "Ce lien Victory Automatic appartient déjà à un autre membre."
    );
  }

  if (!user.victory_parent_identifier) {
    throw new Error(
      "Le parrain Victory attribué est introuvable."
    );
  }

  /*
    Le lien du parrain est reconstruit
    à partir de l’identifiant enregistré
    lors de l’attribution.
  */
  const realParentLink =
    buildVictoryLink(
      user.victory_parent_identifier
    );

  if (
    normalizedPersonalLink ===
    realParentLink
  ) {
    throw new Error(
      "Votre lien personnel ne peut pas être identique au lien du parrain."
    );
  }

  const opportunity =
    await repository
      .findVictoryOpportunityRootLink();

  if (!opportunity) {
    throw new Error(
      "L’opportunité Victory Automatic est introuvable ou désactivée."
    );
  }

  /*
    Le moteur Follow Me vérifie ici que
    le lien du parrain est déjà présent
    dans opportunity_assignments.
  */
  const assignment =
    await opportunityService
      .registerFollowMeLink({
        userId,
        opportunityId:
          opportunity.id,

        assignedSponsorLink:
          realParentLink,

        personalLink:
          normalizedPersonalLink,

        realParentLink
      });

  const savedUser =
    await repository.saveVictoryPersonalLink(
      userId,
      normalizedPersonalLink
    );

  if (!savedUser) {
    throw new Error(
      "Impossible d’enregistrer le lien Victory Automatic."
    );
  }

  return {
    victoryPersonalLink:
      savedUser.victory_personal_link,

    victoryParentLink:
      realParentLink,

    assignmentId:
      assignment.id,

    opportunityId:
      opportunity.id,

    assignmentSource:
      assignment.assignment_source
  };
}

async function reactivateVictory(userId) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const user =
    await repository.reactivateVictoryUser(
      userId
    );

  if (!user) {
    throw new Error(
      "Ce compte n’est pas expiré ou ne peut pas être réactivé."
    );
  }

  return {
    message:
      "Votre compte a été réactivé avec succès. Un nouveau délai de 24 heures commence maintenant.",

    status:
      user.status,

    startedAt:
      user.victory_started_at,

    expiresAt:
      user.victory_expires_at,

    victoryExpired:
      user.victory_expired,

    linkActive:
      user.link_active
  };
}

module.exports = {
  assignVictoryLink,
  saveVictoryPersonalLink,
  reactivateVictory
};