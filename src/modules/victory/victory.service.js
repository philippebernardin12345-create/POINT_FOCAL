const repository = require("./victory.repository");

const DEFAULT_VICTORY_LINK = "https://victoryautomatic.com/user/register/okoningana";

async function assignVictoryLink(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + 24 * 60 * 60 * 1000
  );

  await repository.markVictoryAssigned(
    userId,
    now,
    expiresAt
  );

  return {
    url: DEFAULT_VICTORY_LINK,
    startedAt: now,
    expiresAt
  };
}

module.exports = {
  assignVictoryLink
};