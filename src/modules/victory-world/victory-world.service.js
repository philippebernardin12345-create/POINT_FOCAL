const repository =
  require("./victory-world.repository");

const {
  web3,
  USDT_CONTRACT,
  ERC20_TRANSFER_TOPIC
} = require("../../config/blockchain");

const MIN_VICTORY_WORLD_USDT = 5;
const USDT_DECIMALS = 18;
const REQUIRED_CONFIRMATIONS = 12;

function normalizeAddress(address) {
  return String(address || "")
    .trim()
    .toLowerCase();
}

function validateVictoryWorldLink(link) {
  let parsedUrl;

  try {
    parsedUrl = new URL(
      String(link || "").trim()
    );
  } catch {
    throw new Error(
      "Format du lien Victory World invalide."
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname.toLowerCase() !==
      "victoryworld.club"
  ) {
    throw new Error(
      "Le lien doit commencer par https://victoryworld.club/."
    );
  }

  const pathParts =
    parsedUrl.pathname
      .split("/")
      .filter(Boolean);

  if (pathParts.length !== 1) {
    throw new Error(
      "Le lien Victory World doit respecter le format https://victoryworld.club/identifiant."
    );
  }

  const identifier =
    decodeURIComponent(
      pathParts[0]
    ).trim();

  if (
    !identifier ||
    !/^[a-zA-Z0-9._-]+$/.test(
      identifier
    )
  ) {
    throw new Error(
      "Identifiant Victory World invalide."
    );
  }

  return {
    identifier,
    normalizedLink:
      `https://victoryworld.club/${identifier}`
  };
}

function validateTargetAddress(address) {
  const normalizedAddress =
    normalizeAddress(address);

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
      "Adresse blockchain cible invalide."
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
      "Hash de transaction invalide."
    );
  }

  return normalizedTxHash;
}

function decodeTransferLog(log) {
  if (
    !log ||
    !log.topics ||
    log.topics.length < 3
  ) {
    throw new Error(
      "Journal blockchain invalide."
    );
  }

  const from =
    "0x" +
    String(log.topics[1]).slice(26);

  const to =
    "0x" +
    String(log.topics[2]).slice(26);

  const amountRaw =
    BigInt(log.data);

  const amount =
    Number(amountRaw) /
    Math.pow(
      10,
      USDT_DECIMALS
    );

  return {
    from:
      normalizeAddress(from),

    to:
      normalizeAddress(to),

    amount
  };
}

async function getTransactionTimestamp(
  blockNumber
) {
  const block =
    await web3.eth.getBlock(
      blockNumber
    );

  if (!block) {
    throw new Error(
      "Bloc de la transaction introuvable."
    );
  }

  return Number(
    block.timestamp
  );
}

async function verifyUsdtPayment(
  txHash,
  targetAddress,
  minimumAmount,
  victoryWorldStartedAt
) {
  const receipt =
    await web3.eth
      .getTransactionReceipt(
        txHash
      );

  if (!receipt) {
    throw new Error(
      "Transaction introuvable sur la BNB Chain."
    );
  }

  if (!receipt.status) {
    throw new Error(
      "Transaction échouée."
    );
  }

  const latestBlockNumber =
    await web3.eth
      .getBlockNumber();

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

  const transferLog =
    receipt.logs.find((log) => {
      if (
        !log.topics ||
        log.topics.length < 3
      ) {
        return false;
      }

      const logContract =
        normalizeAddress(
          log.address
        );

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
          targetAddress
      );
    });

  if (!transferLog) {
    throw new Error(
      "Aucun transfert USDT BEP-20 vers l’adresse indiquée."
    );
  }

  const payment =
    decodeTransferLog(
      transferLog
    );

  if (
    payment.amount <
    minimumAmount
  ) {
    throw new Error(
      `Montant insuffisant. Minimum requis : ${minimumAmount} USDT.`
    );
  }

  const transactionTimestamp =
    await getTransactionTimestamp(
      receipt.blockNumber
    );

  const startedAtMilliseconds =
    new Date(
      victoryWorldStartedAt
    ).getTime();

  if (
    !startedAtMilliseconds ||
    Number.isNaN(
      startedAtMilliseconds
    )
  ) {
    throw new Error(
      "Date de démarrage Victory World invalide."
    );
  }

  const startedAtSeconds =
    Math.floor(
      startedAtMilliseconds / 1000
    );

  if (
    transactionTimestamp <
    startedAtSeconds
  ) {
    throw new Error(
      "Transaction trop ancienne. Le paiement doit être effectué après l’enregistrement du lien Victory World."
    );
  }

  return {
    ...payment,
    confirmations,
    blockNumber:
      Number(
        receipt.blockNumber
      ),
    transactionTimestamp
  };
}

async function saveLink(
  userId,
  payload = {}
) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (
    user.victory_world_status ===
    "validated"
  ) {
    return {
      success: true,
      alreadyValidated: true,
      message:
        "Victory World est déjà validé.",
      victoryWorldLink:
        user.victory_world_link,
      status:
        user.victory_world_status
    };
  }

  const {
    normalizedLink
  } = validateVictoryWorldLink(
    payload.victoryWorldLink
  );

  const saved =
    await repository
      .saveVictoryWorldLink(
        userId,
        normalizedLink
      );

  if (!saved) {
    throw new Error(
      "Impossible d’enregistrer le lien Victory World."
    );
  }

  return {
    success: true,
    message:
      "Lien Victory World enregistré. Paiement en attente.",
    victoryWorldLink:
      saved.victory_world_link,
    status:
      saved.victory_world_status,
    startedAt:
      saved.victory_world_started_at
  };
}

async function validatePayment(
  userId,
  payload = {}
) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (
    user.victory_world_status ===
    "validated"
  ) {
    return {
      success: true,
      alreadyValidated: true,
      message:
        "Le paiement Victory World a déjà été validé.",
      status:
        user.victory_world_status
    };
  }

  if (
    !user.victory_world_link
  ) {
    throw new Error(
      "Enregistrez d’abord votre lien Victory World."
    );
  }

  if (
    !user.victory_world_started_at
  ) {
    throw new Error(
      "Date de démarrage Victory World introuvable. Enregistrez à nouveau votre lien."
    );
  }

 const normalizedTxHash =
  validateTransactionHash(
    payload.txHash
  );

const normalizedTargetAddress =
  normalizeAddress(
    paymentReceiverAddress
  );

  const existingPayment =
    await repository
      .findPaymentByHash(
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
      MIN_VICTORY_WORLD_USDT,
      user.victory_world_started_at
    );

  await repository
    .saveVictoryWorldPayment(
      userId,
      user.campaign_id,
      normalizedTxHash,
      normalizedTargetAddress,
      payment.amount
    );

  const validated =
  await repository
    .validateVictoryWorld(
      userId,
      normalizedTxHash
    );

if (!validated) {
  throw new Error(
    "Impossible de valider Victory World."
  );
}

const nextOpportunity =
  await repository
    .findNextOpportunity(2);

return {
  success: true,

  message:
    "Paiement Victory World validé. L’opportunité suivante est maintenant accessible.",

  status:
    validated.victory_world_status,

  victoryWorldLink:
    validated.victory_world_link,

  nextOpportunityUnlocked:
    !!nextOpportunity,

  nextOpportunity,

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
async function getStatus(userId) {
  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  return {
    victoryWorldLink:
      user.victory_world_link,

    status:
      user.victory_world_status ||
      "not_started",

    txHash:
      user.victory_world_tx_hash,

    paidAt:
      user.victory_world_paid_at,

    startedAt:
      user.victory_world_started_at,

    nextOpportunityUnlocked:
      user.victory_world_status ===
      "validated"
  };
}

module.exports = {
  saveLink,
  validatePayment,
  getStatus
};