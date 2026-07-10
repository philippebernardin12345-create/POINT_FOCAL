const repository = require("./payments.repository");
const {
  web3,
  USDT_CONTRACT,
  ERC20_TRANSFER_TOPIC
} = require("../../config/blockchain");

const MIN_USDT_AMOUNT = 2.03;
const USDT_DECIMALS = 18;
const REQUIRED_CONFIRMATIONS = 12;

function normalizeAddress(address) {
  return String(address || "").trim().toLowerCase();
}

function decodeTransferLog(log) {
  const from = "0x" + log.topics[1].slice(26);
  const to = "0x" + log.topics[2].slice(26);
  const amountRaw = BigInt(log.data);

  const amount =
    Number(amountRaw) / Math.pow(10, USDT_DECIMALS);

  return {
    from: normalizeAddress(from),
    to: normalizeAddress(to),
    amount
  };
}

async function getTransactionTimestamp(blockNumber) {
  const block = await web3.eth.getBlock(blockNumber);

  if (!block) {
    throw new Error("Bloc de la transaction introuvable.");
  }

  return Number(block.timestamp);
}

async function verifyUsdtPayment(
  txHash,
  adresseCible,
  victoryAssignedAt
) {
  const receipt = await web3.eth.getTransactionReceipt(txHash);

  if (!receipt) {
    throw new Error(
      "Transaction introuvable sur la BNB Chain."
    );
  }

  if (!receipt.status) {
    throw new Error(
      "Transaction échouée ou non confirmée."
    );
  }

  const latestBlockNumber = await web3.eth.getBlockNumber();

  const confirmations =
    Number(latestBlockNumber) -
    Number(receipt.blockNumber) +
    1;

  if (confirmations < REQUIRED_CONFIRMATIONS) {
    throw new Error(
      `Transaction trop récente. ${confirmations}/${REQUIRED_CONFIRMATIONS} confirmations.`
    );
  }

  const victoryAssignedAtMs =
    new Date(victoryAssignedAt).getTime();

  if (
    !victoryAssignedAtMs ||
    Number.isNaN(victoryAssignedAtMs)
  ) {
    throw new Error(
      "Date d’attribution du lien Victory invalide."
    );
  }

  const victoryAssignedAtSeconds =
    Math.floor(victoryAssignedAtMs / 1000);

  const transactionTimestamp =
    await getTransactionTimestamp(receipt.blockNumber);

  if (transactionTimestamp < victoryAssignedAtSeconds) {
    throw new Error(
      "Transaction trop ancienne. Le don doit être effectué après l’attribution du lien Victory Automatic."
    );
  }

  const targetAddress = normalizeAddress(adresseCible);

  if (!web3.utils.isAddress(targetAddress)) {
    throw new Error("Adresse cible invalide.");
  }

  const transferLog = receipt.logs.find((log) => {
    if (
      !log.topics ||
      log.topics.length < 3
    ) {
      return false;
    }

    const logContract = normalizeAddress(log.address);
    const transferTopic = String(log.topics[0]).toLowerCase();

    const logTargetAddress = normalizeAddress(
      "0x" + String(log.topics[2]).slice(26)
    );

    return (
      logContract === normalizeAddress(USDT_CONTRACT) &&
      transferTopic ===
        String(ERC20_TRANSFER_TOPIC).toLowerCase() &&
      logTargetAddress === targetAddress
    );
  });

  if (!transferLog) {
    throw new Error(
      "Aucun transfert USDT BEP-20 vers l’adresse cible indiquée."
    );
  }

  const payment = decodeTransferLog(transferLog);

  if (payment.amount < MIN_USDT_AMOUNT) {
    throw new Error(
      `Montant insuffisant. Minimum requis : ${MIN_USDT_AMOUNT} USDT.`
    );
  }

  return {
    ...payment,
    confirmations,
    blockNumber: Number(receipt.blockNumber),
    transactionTimestamp
  };
}

async function autoTrigger(userId, payload = {}) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const {
    victoryLink,
    adresseCible,
    txHash
  } = payload;

  if (!victoryLink) {
    throw new Error(
      "Lien Victory Automatic obligatoire."
    );
  }

  if (!adresseCible) {
    throw new Error("Adresse cible obligatoire.");
  }

  if (!web3.utils.isAddress(adresseCible)) {
    throw new Error("Format de l’adresse cible invalide.");
  }

  if (!txHash) {
    throw new Error(
      "Hash de transaction obligatoire."
    );
  }

  if (
    !web3.utils.isHexStrict(txHash) ||
    txHash.length !== 66
  ) {
    throw new Error(
      "Format du hash de transaction invalide."
    );
  }

  if (
    !victoryLink.startsWith(
      "https://victoryautomatic.com/user/register/"
    )
  ) {
    throw new Error(
      "Lien Victory Automatic invalide."
    );
  }

  const paymentStart =
    await repository.findUserPaymentStart(userId);

  if (
    !paymentStart ||
    !paymentStart.victory_assigned_at
  ) {
    throw new Error(
      "Aucune attribution Victory Automatic trouvée pour cet utilisateur."
    );
  }

  const existingPayment =
    await repository.findPaymentByHash(txHash);

  if (existingPayment) {
    throw new Error(
      "Ce hash de transaction a déjà été utilisé."
    );
  }

  const sponsorCode = victoryLink
    .split("/")
    .filter(Boolean)
    .pop();

  if (!sponsorCode) {
    throw new Error(
      "Code du parrain Victory Automatic introuvable."
    );
  }

  const sponsor =
    await repository.findUserBySeries3Code(
      sponsorCode
    );

  if (!sponsor) {
    throw new Error(
      "Ce lien Victory appartient à un parrain non enregistré dans Point Focal."
    );
  }

  const payment = await verifyUsdtPayment(
    txHash,
    adresseCible,
    paymentStart.victory_assigned_at
  );

  await repository.savePayment(
    userId,
    txHash,
    normalizeAddress(adresseCible),
    payment.amount
  );

  return {
    success: true,
    message: "Paiement USDT validé.",
    publicLink:
      `https://pointfocalapp.com/register.html?ref=${sponsor.invitation_code_series_3}`,
    payment: {
      amount: payment.amount,
      targetAddress: payment.to,
      confirmations: payment.confirmations,
      blockNumber: payment.blockNumber
    }
  };
}

module.exports = {
  autoTrigger
};