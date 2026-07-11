const repository = require("./victory.repository");

const DEFAULT_VICTORY_LINK =
  "https://victoryautomatic.com/user/register/okoningana";

async function assignVictoryLink(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + 24 * 60 * 60 * 1000
  );

  const user = await repository.markVictoryAssigned(
    userId,
    now,
    expiresAt
  );

  if (!user) {
    throw new Error(
      "Impossible d’attribuer le lien Victory Automatic."
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

  return {
    url: DEFAULT_VICTORY_LINK,
    startedAt: user.victory_started_at,
    expiresAt: user.victory_expires_at
  };
}

async function reactivateVictory(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const user = await repository.reactivateVictoryUser(
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
    startedAt: user.victory_started_at,
    expiresAt: user.victory_expires_at,
    victoryExpired: user.victory_expired,
    linkActive: user.link_active
  };
}

module.exports = {
  assignVictoryLink,
  reactivateVictory
};