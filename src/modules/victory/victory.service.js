const repository = require("./victory.repository");

async function assignVictoryLink(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const userWithSponsor =
    await repository.findUserWithSponsor(userId);

  if (!userWithSponsor) {
    throw new Error("Utilisateur introuvable.");
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
    Priorité 1 :
    lien Victory Automatic du parrain réel
    enregistré dans sponsor_id.
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
    Priorité 2 :
    lien Victory Automatic du compte racine.
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

      source = "root-user";
    }
  }

  /*
    Priorité 3 :
    lien racine enregistré dans opportunities
    pour Victory Automatic, position 1.
  */
  if (!assignedVictoryLink) {
    const rootOpportunity =
      await repository.findVictoryOpportunityRootLink();

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
      "Aucun lien Victory Automatic disponible pour votre parrain ni pour la racine."
    );
  }

  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + 24 * 60 * 60 * 1000
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
    sponsorUserId: assignedSponsorUserId,
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
    status: user.status,
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