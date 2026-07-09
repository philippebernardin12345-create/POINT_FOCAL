const repository = require("./payments.repository");
const { web3, USDT_CONTRACT, ERC20_TRANSFER_TOPIC } = require("../../config/blockchain");

const MIN_USDT_AMOUNT = 2.03;
const USDT_DECIMALS = 18;

function normalizeAddress(address) {
  return String(address || "").trim().toLowerCase();
}

function decodeTransferLog(log) {
  const from = "0x" + log.topics[1].slice(26);
  const to = "0x" + log.topics[2].slice(26);
  const amountRaw = BigInt(log.data);
  const amount = Number(amountRaw) / Math.pow(10, USDT_DECIMALS);

  return { from, to, amount };
}

async function verifyUsdtPayment(txHash, adresseCible) {
  const receipt = await web3.eth.getTransactionReceipt(txHash);

  if (!receipt) {
    throw new Error("Transaction introuvable sur la BNB Chain.");
  }

  if (!receipt.status) {
    throw new Error("Transaction échouée ou non confirmée.");
  }

  const targetAddress = normalizeAddress(adresseCible);

  const transferLog = receipt.logs.find((log) => {
    return (
      normalizeAddress(log.address) === USDT_CONTRACT &&
      log.topics &&
      log.topics[0] === ERC20_TRANSFER_TOPIC &&
      log.topics.length >= 3 &&
      normalizeAddress("0x" + log.topics[2].slice(26)) === targetAddress
    );
  });

  if (!transferLog) {
    throw new Error("Aucun transfert USDT BEP-20 vers l'adresse cible.");
  }

  const payment = decodeTransferLog(transferLog);

  if (payment.amount < MIN_USDT_AMOUNT) {
    throw new Error("Montant insuffisant. Minimum requis : 2,03 USDT.");
  }

  return payment;
}

async function autoTrigger(userId, payload) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const { victoryLink, adresseCible, txHash } = payload;

  if (!victoryLink) {
    throw new Error("Lien Victory obligatoire.");
  }

  if (!adresseCible) {
    throw new Error("Adresse cible obligatoire.");
  }

  if (!txHash) {
    throw new Error("Hash de transaction obligatoire.");
  }

  if (!victoryLink.startsWith("https://victoryautomatic.com/user/register/")) {
    throw new Error("Lien Victory Automatic invalide.");
  }

  const existingPayment = await repository.findPaymentByHash(txHash);

  if (existingPayment) {
    throw new Error("Ce hash de transaction a déjà été utilisé.");
  }

  const sponsorCode = victoryLink.split("/").pop();

  const sponsor = await repository.findUserBySeries3Code(sponsorCode);

  if (!sponsor) {
    throw new Error("Ce lien Victory appartient à un parrain non enregistré dans Point Focal.");
  }

  const payment = await verifyUsdtPayment(txHash, adresseCible);

  await repository.savePayment(
    userId,
    txHash,
    normalizeAddress(adresseCible),
    payment.amount
  );

  return {
    publicLink: `https://pointfocalapp.com/register.html?ref=${sponsor.invitation_code_series_3}`
  };
}

module.exports = {
  autoTrigger
};