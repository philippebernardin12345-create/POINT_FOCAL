const DEFAULT_VICTORY_LINK = "https://victoryautomatic.com/user/register/lobongo01";

async function assignVictoryLink(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  return {
    url: DEFAULT_VICTORY_LINK
  };
}

module.exports = {
  assignVictoryLink
};