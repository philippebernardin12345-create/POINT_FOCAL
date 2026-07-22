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
      "Bloc introuvable."
    );
  }

  return Number(
    block.timestamp
  );
}

async function verifyUsdtPayment(
  txHash,
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
      "Transaction introuvable."
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
      `Transaction trop récente (${confirmations}/${REQUIRED_CONFIRMATIONS}).`
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

      return (
        normalizeAddress(
          log.address
        ) ===
          normalizeAddress(
            USDT_CONTRACT
          ) &&
        String(
          log.topics[0]
        ).toLowerCase() ===
          String(
            ERC20_TRANSFER_TOPIC
          ).toLowerCase()
      );
    });

  if (!transferLog) {
    throw new Error(
      "Aucun transfert USDT trouvé."
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
      `Montant insuffisant. Minimum : ${minimumAmount} USDT.`
    );
  }

  const transactionTimestamp =
    await getTransactionTimestamp(
      receipt.blockNumber
    );

  const startedAt =
    Math.floor(
      new Date(
        victoryWorldStartedAt
      ).getTime() / 1000
    );

  if (
    transactionTimestamp <
    startedAt
  ) {
    throw new Error(
      "Transaction trop ancienne."
    );
  }

  return {
    ...payment,
    confirmations,
    blockNumber:
      Number(
        receipt.blockNumber
      )
  };
}

async function saveLink(
  userId,
  payload = {}
) {
  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
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

  return {
    success: true,
    message:
      "Lien Victory World enregistré.",
    victoryWorldLink:
      saved.victory_world_link,
    status:
      saved.victory_world_status
  };
}

async function validatePayment(
  userId,
  payload = {}
) {
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
    !user.victory_world_link
  ) {
    throw new Error(
      "Enregistrez votre lien Victory World."
    );
  }

  const normalizedTxHash =
    validateTransactionHash(
      payload.txHash
    );

  const existingPayment =
    await repository
      .findPaymentByHash(
        normalizedTxHash
      );

  if (existingPayment) {
    throw new Error(
      "Hash déjà utilisé."
    );
  }

  const payment =
    await verifyUsdtPayment(
      normalizedTxHash,
      MIN_VICTORY_WORLD_USDT,
      user.victory_world_started_at
    );

  await repository
    .saveVictoryWorldPayment(
      userId,
      user.campaign_id,
      normalizedTxHash,
      payment.to,
      payment.amount
    );

  const validated =
    await repository
      .validateVictoryWorld(
        userId,
        normalizedTxHash
      );

  const nextOpportunity =
    await repository
      .findNextOpportunity(2);

  return {
    success: true,

    message:
      "Paiement Victory World validé.",

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