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

/*
============================================================
OUTILS
============================================================
*/

function normalizeAddress(address) {
  return String(address || "")
    .trim()
    .toLowerCase();
}

function validateBlockchainAddress(
  address
) {
  const normalizedAddress =
    normalizeAddress(address);

  if (
    !normalizedAddress ||
    !web3.utils.isAddress(
      normalizedAddress
    )
  ) {
    throw new Error(
      "Adresse cible BNB Chain invalide."
    );
  }

  return normalizedAddress;
}

function validateVictoryWorldLink(link) {
  let parsedUrl;

  try {
    parsedUrl =
      new URL(
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

function validateTransactionHash(
  txHash
) {
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
    String(
      log.topics[1]
    ).slice(26);

  const to =
    "0x" +
    String(
      log.topics[2]
    ).slice(26);

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
      "Bloc de transaction introuvable."
    );
  }

  return Number(
    block.timestamp
  );
}

/*
============================================================
ATTRIBUTION DU PARRAIN VICTORY WORLD
============================================================
*/

async function ensureAssignedSponsor(
  user
) {
  if (
    user.victory_world_assigned_link
  ) {
    const existingSponsor =
      await repository
        .findUserByVictoryWorldLink(
          user.victory_world_assigned_link
        );

    if (!existingSponsor) {
      throw new Error(
        "Le parrain Victory World attribué n’existe plus dans Point Focal."
      );
    }

    return {
      assignedLink:
        user.victory_world_assigned_link,

      sponsor:
        existingSponsor
    };
  }

  const sponsor =
    await repository
      .findVictoryWorldSponsorLink();

  if (
    !sponsor ||
    !sponsor.victory_world_link
  ) {
    throw new Error(
      "Aucun parrain Victory World validé n’est actuellement disponible."
    );
  }

  const savedAssignment =
    await repository
      .saveAssignedVictoryWorldLink(
        user.id,
        sponsor.victory_world_link
      );

  if (!savedAssignment) {
    throw new Error(
      "Impossible d’attribuer un parrain Victory World."
    );
  }

  return {
    assignedLink:
      savedAssignment
        .victory_world_assigned_link,

    sponsor
  };
}

/*
============================================================
VÉRIFICATION BLOCKCHAIN
============================================================
*/

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
      "La transaction blockchain a échoué."
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
      `Transaction trop récente : ${confirmations}/${REQUIRED_CONFIRMATIONS} confirmations.`
    );
  }

  const transferLogs =
    receipt.logs.filter(
      (log) => {
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

        return (
          logContract ===
            normalizeAddress(
              USDT_CONTRACT
            ) &&
          transferTopic ===
            String(
              ERC20_TRANSFER_TOPIC
            ).toLowerCase()
        );
      }
    );

  if (
    transferLogs.length === 0
  ) {
    throw new Error(
      "Aucun transfert USDT BEP-20 trouvé dans cette transaction."
    );
  }

  const matchingPayments =
    transferLogs
      .map(
        decodeTransferLog
      )
      .filter(
        (payment) =>
          payment.to ===
          targetAddress
      );

  if (
    matchingPayments.length === 0
  ) {
    throw new Error(
      "Cette transaction n’a pas envoyé d’USDT à l’adresse cible indiquée."
    );
  }

  const totalAmount =
    matchingPayments.reduce(
      (
        total,
        payment
      ) =>
        total +
        payment.amount,
      0
    );

  if (
    totalAmount <
    minimumAmount
  ) {
    throw new Error(
      `Montant insuffisant. Minimum requis : ${minimumAmount} USDT. Montant détecté : ${totalAmount} USDT.`
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
    !Number.isFinite(
      startedAtMilliseconds
    )
  ) {
    throw new Error(
      "Date de démarrage Victory World invalide."
    );
  }

  const startedAtSeconds =
    Math.floor(
      startedAtMilliseconds /
      1000
    );

  if (
    transactionTimestamp <
    startedAtSeconds
  ) {
    throw new Error(
      "Cette transaction est antérieure à l’enregistrement de votre lien Victory World."
    );
  }

  return {
    from:
      matchingPayments[0].from,

    to:
      targetAddress,

    amount:
      totalAmount,

    confirmations,

    blockNumber:
      Number(
        receipt.blockNumber
      ),

    transactionTimestamp
  };
}

/*
============================================================
ENREGISTRER LE LIEN PERSONNEL
============================================================
*/

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

  if (
    user.victory_world_status ===
    "validated"
  ) {
    throw new Error(
      "Victory World est déjà validé pour ce compte."
    );
  }

  const {
    normalizedLink
  } = validateVictoryWorldLink(
    payload.victoryWorldLink
  );

  const assignment =
    await ensureAssignedSponsor(
      user
    );

  const registeredSponsor =
    await repository
      .findUserByVictoryWorldLink(
        assignment.assignedLink
      );

  if (!registeredSponsor) {
    throw new Error(
      "Le lien du parrain Victory World n’appartient à aucun membre enregistré dans Point Focal."
    );
  }

  if (
    normalizedLink ===
    assignment.assignedLink
  ) {
    throw new Error(
      "Votre lien personnel Victory World doit être différent du lien de votre parrain."
    );
  }

  const existingOwner =
    await repository
      .findUserByVictoryWorldLink(
        normalizedLink
      );

  if (
    existingOwner &&
    Number(existingOwner.id) !==
      Number(userId)
  ) {
    throw new Error(
      "Ce lien Victory World est déjà utilisé par un autre compte Point Focal."
    );
  }

  const saved =
    await repository
      .saveVictoryWorldLink(
        userId,
        normalizedLink
      );

  if (!saved) {
    throw new Error(
      "Impossible d’enregistrer votre lien Victory World."
    );
  }

  return {
    success: true,

    message:
      "Lien Victory World enregistré.",

    victoryWorldLink:
      saved.victory_world_link,

    assignedLink:
      assignment.assignedLink,

    sponsorUserId:
      registeredSponsor.id,

    status:
      saved.victory_world_status,

    startedAt:
      saved.victory_world_started_at
  };
}

/*
============================================================
VALIDER LE PAIEMENT
============================================================
*/

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
    user.victory_world_status ===
    "validated"
  ) {
    throw new Error(
      "Victory World est déjà validé pour ce compte."
    );
  }

  if (
    !user.victory_world_link
  ) {
    throw new Error(
      "Enregistrez d’abord votre lien personnel Victory World."
    );
  }

  if (
    !user.victory_world_assigned_link
  ) {
    throw new Error(
      "Aucun parrain Victory World n’a été attribué à ce compte."
    );
  }

  const registeredSponsor =
    await repository
      .findUserByVictoryWorldLink(
        user.victory_world_assigned_link
      );

  if (!registeredSponsor) {
    throw new Error(
      "Le lien de parrain attribué n’existe pas dans la base Point Focal."
    );
  }

  const normalizedTargetAddress =
    validateBlockchainAddress(
      payload.adresseCible ||
      payload.targetAddress
    );

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
    .saveVictoryWorldTargetAddress(
      userId,
      normalizedTargetAddress
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

    assignedLink:
      validated
        .victory_world_assigned_link,

    targetAddress:
      validated
        .victory_world_target_address,

    nextOpportunityUnlocked:
      Boolean(
        nextOpportunity
      ),

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

/*
============================================================
STATUT
============================================================
*/

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

  let assignedLink =
    user.victory_world_assigned_link;

  if (!assignedLink) {
    const assignment =
      await ensureAssignedSponsor(
        user
      );

    assignedLink =
      assignment.assignedLink;
  } else {
    const sponsor =
      await repository
        .findUserByVictoryWorldLink(
          assignedLink
        );

    if (!sponsor) {
      throw new Error(
        "Le lien du parrain Victory World attribué n’existe plus dans la base."
      );
    }
  }

  return {
    success: true,

    assignedLink,

    victoryWorldLink:
      user.victory_world_link,

    targetAddress:
      user
        .victory_world_target_address,

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