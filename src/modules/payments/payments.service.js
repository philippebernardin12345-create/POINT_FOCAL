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
  return String(address || "")
    .trim()
    .toLowerCase();
}

function generateSeries1Code() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let lettersPart = "";

  for (let i = 0; i < 4; i++) {
    lettersPart +=
      letters[Math.floor(Math.random() * letters.length)];
  }

  const numbersPart =
    Math.floor(1000 + Math.random() * 9000);

  return `${lettersPart}${numbersPart}`;
}

function generateSeries2Code() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let lettersPart = "";

  for (let i = 0; i < 4; i++) {
    lettersPart +=
      letters[Math.floor(Math.random() * letters.length)];
  }

  const numbersPart =
    Math.floor(1000 + Math.random() * 9000);

  return `${numbersPart}${lettersPart}`;
}

function generateSeries3Code(email) {
  const emailPrefix = String(email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);

  const randomSuffix =
    Math.floor(1000 + Math.random() * 9000);

  return `${emailPrefix}${randomSuffix}`;
}

async function generateUniqueCode(generator, seed) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = generator(seed);

    const existingUser =
      await repository.findUserByInvitationCode(code);

    if (!existingUser) {
      return code;
    }
  }

  throw new Error(
    "Impossible de générer un code d’invitation unique."
  );
}

function decodeTransferLog(log) {
  const from =
    "0x" + String(log.topics[1]).slice(26);

  const to =
    "0x" + String(log.topics[2]).slice(26);

  const amountRaw = BigInt(log.data);

  const amount =
    Number(amountRaw) /
    Math.pow(10, USDT_DECIMALS);

  return {
    from: normalizeAddress(from),
    to: normalizeAddress(to),
    amount
  };
}

async function getTransactionTimestamp(blockNumber) {
  const block =
    await web3.eth.getBlock(blockNumber);

  if (!block) {
    throw new Error(
      "Bloc de la transaction introuvable."
    );
  }

  return Number(block.timestamp);
}

async function verifyUsdtPayment(
  txHash,
  adresseCible,
  victoryAssignedAt
) {
  const receipt =
    await web3.eth.getTransactionReceipt(txHash);

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

  const latestBlockNumber =
    await web3.eth.getBlockNumber();

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
    await getTransactionTimestamp(
      receipt.blockNumber
    );

  if (
    transactionTimestamp <
    victoryAssignedAtSeconds
  ) {
    throw new Error(
      "Transaction trop ancienne. Le don doit être effectué après l’attribution du lien Victory Automatic."
    );
  }

  const targetAddress =
    normalizeAddress(adresseCible);

  if (!web3.utils.isAddress(targetAddress)) {
    throw new Error(
      "Adresse cible invalide."
    );
  }

  const transferLog =
    receipt.logs.find((log) => {
      if (
        !log.topics ||
        log.topics.length < 3
      ) {
        return false;
      }

      const logContract =
        normalizeAddress(log.address);

      const transferTopic =
        String(log.topics[0]).toLowerCase();

      const logTargetAddress =
        normalizeAddress(
          "0x" +
          String(log.topics[2]).slice(26)
        );

      return (
        logContract ===
          normalizeAddress(USDT_CONTRACT) &&
        transferTopic ===
          String(
            ERC20_TRANSFER_TOPIC
          ).toLowerCase() &&
        logTargetAddress === targetAddress
      );
    });

  if (!transferLog) {
    throw new Error(
      "Aucun transfert USDT BEP-20 vers l’adresse cible indiquée."
    );
  }

  const payment =
    decodeTransferLog(transferLog);

  if (payment.amount < MIN_USDT_AMOUNT) {
    throw new Error(
      `Montant insuffisant. Minimum requis : ${MIN_USDT_AMOUNT} USDT.`
    );
  }

  return {
    ...payment,
    confirmations,
    blockNumber:
      Number(receipt.blockNumber),
    transactionTimestamp
  };
}

async function autoTrigger(
  userId,
  payload = {}
) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const {
    victoryLink,
    adresseCible,
    txHash
  } = payload;

  if (!victoryLink) {
    throw new Error(
      "Lien Victory Automatic personnel obligatoire."
    );
  }

  let parsedVictoryUrl;

  try {
    parsedVictoryUrl =
      new URL(victoryLink);
  } catch {
    throw new Error(
      "Format du lien Victory Automatic invalide."
    );
  }

  if (
    parsedVictoryUrl.protocol !== "https:" ||
    parsedVictoryUrl.hostname !==
      "victoryautomatic.com" ||
    !parsedVictoryUrl.pathname.startsWith(
      "/user/register/"
    )
  ) {
    throw new Error(
      "Lien Victory Automatic invalide."
    );
  }

  if (!adresseCible) {
    throw new Error(
      "Adresse cible obligatoire."
    );
  }

  if (
    !web3.utils.isAddress(adresseCible)
  ) {
    throw new Error(
      "Format de l’adresse cible invalide."
    );
  }

  if (!txHash) {
    throw new Error(
      "Hash de transaction obligatoire."
    );
  }

  const normalizedTxHash =
    txHash.trim().toLowerCase();

  if (
    !web3.utils.isHexStrict(
      normalizedTxHash
    ) ||
    normalizedTxHash.length !== 66
  ) {
    throw new Error(
      "Format du hash de transaction invalide."
    );
  }

  const user =
    await repository.findUserPaymentStart(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (!user.victory_assigned_at) {
    throw new Error(
      "Aucune attribution Victory Automatic trouvée pour cet utilisateur."
    );
  }

  const existingPayment =
    await repository.findPaymentByHash(
      normalizedTxHash
    );

  if (existingPayment) {
    throw new Error(
      "Ce hash de transaction a déjà été utilisé."
    );
  }

  const payment =
    await verifyUsdtPayment(
      normalizedTxHash,
      adresseCible,
      user.victory_assigned_at
    );

  let codeSeries1 =
    user.invitation_code_series_1;

  let codeSeries2 =
    user.invitation_code_series_2;

  let codeSeries3 =
    user.invitation_code_series_3;

  if (!codeSeries1) {
    codeSeries1 =
      await generateUniqueCode(
        generateSeries1Code
      );
  }

  if (!codeSeries2) {
    codeSeries2 =
      await generateUniqueCode(
        generateSeries2Code
      );
  }

  if (!codeSeries3) {
    codeSeries3 =
      await generateUniqueCode(
        generateSeries3Code,
        user.email
      );
  }

  await repository.savePayment(
    userId,
    normalizedTxHash,
    normalizeAddress(adresseCible),
    payment.amount
  );

  const activatedUser =
    await repository.activatePointFocalLink(
      userId,
      codeSeries1,
      codeSeries2,
      codeSeries3
    );

  if (!activatedUser) {
    throw new Error(
      "Impossible d’activer le lien Point Focal."
    );
  }

  const publicLink =
    `https://pointfocalapp.com/register.html?ref=${activatedUser.invitation_code_series_1}`;

  return {
    success: true,
    message:
      "Paiement validé et lien Point Focal activé.",
    publicLink,
    invitationCodes: {
      series1:
        activatedUser.invitation_code_series_1,
      series2:
        activatedUser.invitation_code_series_2,
      series3:
        activatedUser.invitation_code_series_3
    },
    payment: {
      amount: payment.amount,
      targetAddress: payment.to,
      confirmations:
        payment.confirmations,
      blockNumber:
        payment.blockNumber
    }
  };
}

module.exports = {
  autoTrigger
};