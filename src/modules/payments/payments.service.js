const repository = require("./payments.repository");

const TEST_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_HASH = "TEST123456";

async function autoTrigger(userId, payload) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const { victoryLink, adresseCible, txHash } = payload;

  if (!victoryLink) {
    throw new Error("Lien Victory obligatoire.");
  }

  if (!victoryLink.startsWith("https://victoryautomatic.com/user/register/")) {
    throw new Error("Lien Victory Automatic invalide.");
  }

  // Extraction du code du parrain
  const sponsorCode = victoryLink.split("/").pop();

  const sponsor = await repository.findUserBySeries3Code(sponsorCode);

  if (!sponsor) {
    throw new Error("Ce lien Victory appartient à un parrain non enregistré dans Point Focal.");
  }

  if (adresseCible !== TEST_ADDRESS) {
    throw new Error("Adresse cible test invalide.");
  }

  if (txHash !== TEST_HASH) {
    throw new Error("Hash test invalide.");
  }

  return {
    publicLink: `https://pointfocalapp.com/register.html?ref=${sponsor.invitation_code_series_3}`
  };
}

module.exports = {
  autoTrigger
};