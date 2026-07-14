const repository = require("./victory.repository");

function extractVictoryIdentifier(victoryLink) {
  let parsedUrl;

  try {
    parsedUrl = new URL(
      String(victoryLink || "").trim()
    );
  } catch {
    throw new Error(
      "Lien Victory Automatic attribué invalide."
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname.toLowerCase() !==
      "victoryautomatic.com"
  ) {
    throw new Error(
      "Le lien Victory Automatic attribué utilise un domaine invalide."
    );
  }

  const parts =
    parsedUrl.pathname
      .split("/")
      .filter(Boolean);

  if (
    parts.length !== 3 ||
    parts[0] !== "user" ||
    parts[1] !== "register"
  ) {
    throw new Error(
      "Le lien Victory Automatic attribué ne respecte pas le format attendu."
    );
  }

  const identifier =
    decodeURIComponent(parts[2]).trim();

  if (!identifier) {
    throw new Error(
      "Identifiant Victory du parrain introuvable."
    );
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(identifier)) {
    throw new Error(
      "Identifiant Victory du parrain invalide."
    );
  }

  return identifier;
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
      await repository.findOldestAvailableVictorySponsor(
        userWithSponsor.sponsor_user_id || null
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
    await repository.saveVictoryParentIdentifier(
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
    url: assignedVictoryLink,
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
  reactivateVictory
};