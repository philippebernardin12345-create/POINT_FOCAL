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

function decodeTransferLog(log) {
  if (
    !log ||
    !log.topics ||
    log.topics.length < 3
  ) {
    throw new Error(
      "Journal de transfert blockchain invalide."
    );
  }

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

function validateVictoryLink(victoryLink) {
  let parsedVictoryUrl;

  try {
    parsedVictoryUrl = new URL(
      String(victoryLink || "").trim()
    );
  } catch {
    throw new Error(
      "Format du lien Victory Automatic invalide."
    );
  }

  if (
    parsedVictoryUrl.protocol !== "https:" ||
    parsedVictoryUrl.hostname.toLowerCase() !==
      "victoryautomatic.com"
  ) {
    throw new Error(
      "Le lien doit commencer par https://victoryautomatic.com/user/register/."
    );
  }

  const pathParts =
    parsedVictoryUrl.pathname
      .split("/")
      .filter(Boolean);

  if (
    pathParts.length !== 3 ||
    pathParts[0] !== "user" ||
    pathParts[1] !== "register"
  ) {
    throw new Error(
      "Le lien Victory Automatic doit respecter le format https://victoryautomatic.com/user/register/identifiant."
    );
  }

  const victoryIdentifier =
    decodeURIComponent(pathParts[2]).trim();

  if (!victoryIdentifier) {
    throw new Error(
      "Identifiant Victory Automatic introuvable."
    );
  }

  /*
    Refus des caractères dangereux ou inhabituels.
    L’identifiant accepte lettres, chiffres,
    tirets, points et underscores.
  */
  if (
    !/^[a-zA-Z0-9._-]+$/.test(
      victoryIdentifier
    )
  ) {
    throw new Error(
      "Identifiant Victory Automatic invalide."
    );
  }

  return {
    victoryIdentifier,
    normalizedVictoryLink:
      `https://victoryautomatic.com/user/register/${victoryIdentifier}`
  };
}

function validateTargetAddress(adresseCible) {
  const normalizedAddress =
    normalizeAddress(adresseCible);

  if (
    normalizedAddress.length !== 42 ||
    !normalizedAddress.startsWith("0x") ||
    !/^0x[a-f0-9]{40}$/.test(
      normalizedAddress
    ) ||
    !web3.utils.isAddress(
      normalizedAddress
    )
  ) {
    throw new Error(
      "L’adresse cible doit contenir exactement 42 caractères, commencer par 0x et être une adresse blockchain valide."
    );
  }

  return normalizedAddress;
}

function validateTransactionHash(txHash) {
  const normalizedTxHash =
    String(txHash || "")
      .trim()
      .toLowerCase();

  if (
    normalizedTxHash.length !== 66 ||
    !normalizedTxHash.startsWith("0x") ||
    !/^0x[a-f0-9]{64}$/.test(
      normalizedTxHash
    ) ||
    !web3.utils.isHexStrict(
      normalizedTxHash
    )
  ) {
    throw new Error(
      "Le hash doit contenir exactement 66 caractères, commencer par 0x et contenir uniquement des caractères hexadécimaux."
    );
  }

  return normalizedTxHash;
}

async function verifyUsdtPayment(
  txHash,
  adresseCible,
  victoryAssignedAt
) {
  const receipt =
    await web3.eth.getTransactionReceipt(
      txHash
    );

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

  if (
    confirmations <
    REQUIRED_CONFIRMATIONS
  ) {
    throw new Error(
      `Transaction trop récente. ${confirmations}/${REQUIRED_CONFIRMATIONS} confirmations.`
    );
  }

  const victoryAssignedAtMs =
    new Date(
      victoryAssignedAt
    ).getTime();

  if (
    !victoryAssignedAtMs ||
    Number.isNaN(
      victoryAssignedAtMs
    )
  ) {
    throw new Error(
      "Date d’attribution du lien Victory invalide."
    );
  }

  const victoryAssignedAtSeconds =
    Math.floor(
      victoryAssignedAtMs / 1000
    );

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
        String(
          log.topics[0]
        ).toLowerCase();

      const logTargetAddress =
        normalizeAddress(
          "0x" +
          String(
            log.topics[2]
          ).slice(26)
        );

      return (
        logContract ===
          normalizeAddress(
            USDT_CONTRACT
          ) &&
        transferTopic ===
          String(
            ERC20_TRANSFER_TOPIC
          ).toLowerCase() &&
        logTargetAddress ===
          adresseCible
      );
    });

  if (!transferLog) {
    throw new Error(
      "Aucun transfert USDT BEP-20 vers l’adresse cible indiquée."
    );
  }

  const payment =
    decodeTransferLog(
      transferLog
    );

  if (
    payment.amount <
    MIN_USDT_AMOUNT
  ) {
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

  const {
    victoryIdentifier,
    normalizedVictoryLink
  } = validateVictoryLink(
    victoryLink
  );

  const normalizedTargetAddress =
    validateTargetAddress(
      adresseCible
    );

  const normalizedTxHash =
    validateTransactionHash(
      txHash
    );

  const user =
    await repository.findUserPaymentStart(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (
    user.link_active === true &&
    user.victory_personal_link
  ) {
    const existingPublicLink =
        user.invitation_code
          ? `https://pointfocalapp.com/register.html?ref=${user.invitation_code}`
          : null;

      return {
      success: true,
      alreadyValidated: true,
      message:
        "Votre paiement a déjà été validé.",
      publicLink:
        existingPublicLink,
      victoryLink:
        user.victory_personal_link,
      victoryIdentifier:
        user.victory_identifier
    };
  }

  if (
    !user.victory_assigned_at
  ) {
    throw new Error(
      "Aucune attribution Victory Automatic trouvée pour cet utilisateur."
    );
  }

  if (
    user.victory_expired === true ||
    user.status === "expired"
  ) {
    throw new Error(
      "Votre délai de 24 heures a expiré. Votre place a été libérée."
    );
  }

  if (
    user.victory_expires_at &&
    new Date() >=
      new Date(
        user.victory_expires_at
      )
  ) {
    await repository
      .markUserVictoryExpired(
        userId
      );

    throw new Error(
      "Votre délai de 24 heures a expiré. Votre place a été libérée."
    );
  }

  /*
    L’identifiant personnel Victory doit être unique.
    Un autre compte Point Focal ne peut pas utiliser
    le même lien personnel.
  */
  const identifierOwner =
    await repository
      .findUserByVictoryIdentifier(
        victoryIdentifier
      );

  if (
    identifierOwner &&
    String(identifierOwner.id) !==
      String(userId)
  ) {
    throw new Error(
      "Ce lien Victory Automatic appartient déjà à un autre utilisateur Point Focal."
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
      normalizedTargetAddress,
      user.victory_assigned_at
    );

  await repository.savePayment(
  userId,
  user.campaign_id,
  normalizedTxHash,
  normalizedTargetAddress,
  payment.amount
);
  const savedVictoryLink =
    await repository
      .saveVictoryPersonalLink(
        userId,
        normalizedVictoryLink,
        victoryIdentifier
      );

  if (!savedVictoryLink) {
    throw new Error(
      "Impossible d’enregistrer le lien Victory Automatic personnel."
    );
  }

  const activatedUser =
      await repository.activatePointFocalLink(userId);

  if (!activatedUser) {
    throw new Error(
      "Impossible d’activer le lien Point Focal."
    );
  }

  const publicLink =
      `https://pointfocalapp.com/register.html?ref=${activatedUser.invitation_code}`;

  return {
    success: true,
    message:
      "Paiement validé et lien Point Focal activé.",
    publicLink,
    victoryLink:
      savedVictoryLink.victory_personal_link,
    victoryIdentifier:
      savedVictoryLink.victory_identifier,
    invitationCode:
        activatedUser.invitation_code,
    payment: {
      amount:
        payment.amount,
      targetAddress:
        payment.to,
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