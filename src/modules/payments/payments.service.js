
const TEST_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_HASH = "TEST123456";

async function autoTrigger(userId, payload) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const { victoryLink, adresseCible, txHash } = payload;

  if (!victoryLink || victoryLink.length < 10) {
  throw new Error("Lien Victory obligatoire.");
}

if (!victoryLink.startsWith("https://victoryautomatic.com/user/register/")) {
  throw new Error("Lien Victory Automatic invalide.");
}

  if (adresseCible !== TEST_ADDRESS) {
    throw new Error("Adresse cible test invalide.");
  }

  if (txHash !== TEST_HASH) {
    throw new Error("Hash test invalide.");
  }

  return {
    publicLink: "https://pointfocalapp.com/register.html?ref=TESTUSER"
  };
}

module.exports = {
  autoTrigger
};