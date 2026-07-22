const db = require("../../config/db");

async function findUserById(userId) {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      campaign_id,
      victory_world_link,
      victory_world_status,
      victory_world_tx_hash,
      victory_world_paid_at,
      victory_world_started_at,
      victory_world_assigned_link,
      victory_world_target_address
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findPaymentByHash(txHash) {
  const result = await db.query(
    `
    SELECT
      id,
      user_id,
      tx_hash
    FROM payments
    WHERE tx_hash = $1
    LIMIT 1
    `,
    [txHash]
  );

  return result.rows[0] || null;
}

async function findVictoryWorldSponsorLink() {
  const result = await db.query(
    `
    SELECT
      id,
      victory_world_link
    FROM users
    WHERE
      victory_world_link IS NOT NULL
      AND victory_world_link <> ''
      AND victory_world_status = 'validated'
    ORDER BY
      victory_world_paid_at ASC NULLS LAST,
      id ASC
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function saveAssignedVictoryWorldLink(
  userId,
  assignedLink
) {
  const result = await db.query(
    `
    UPDATE users
    SET victory_world_assigned_link = $2
    WHERE id = $1
    RETURNING
      id,
      victory_world_assigned_link
    `,
    [
      userId,
      assignedLink
    ]
  );

  return result.rows[0] || null;
}

async function findUserByVictoryWorldLink(
  victoryWorldLink
) {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      victory_world_link,
      victory_world_status
    FROM users
    WHERE victory_world_link = $1
    LIMIT 1
    `,
    [victoryWorldLink]
  );

  return result.rows[0] || null;
}

async function saveVictoryWorldLink(
  userId,
  victoryWorldLink
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      victory_world_link = $2,
      victory_world_status = 'payment_pending',
      victory_world_tx_hash = NULL,
      victory_world_paid_at = NULL,
      victory_world_started_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      victory_world_link,
      victory_world_status,
      victory_world_started_at,
      victory_world_assigned_link
    `,
    [
      userId,
      victoryWorldLink
    ]
  );

  return result.rows[0] || null;
}

async function saveVictoryWorldPayment(
  userId,
  campaignId,
  txHash,
  targetAddress,
  amount
) {
  const result = await db.query(
    `
    INSERT INTO payments (
      user_id,
      campaign_id,
      tx_hash,
      target_address,
      amount,
      network
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      userId,
      campaignId,
      txHash,
      targetAddress,
      amount,
      "BNB_CHAIN_VICTORY_WORLD"
    ]
  );

  return result.rows[0] || null;
}

async function saveVictoryWorldTargetAddress(
  userId,
  targetAddress
) {
  const result = await db.query(
    `
    UPDATE users
    SET victory_world_target_address = $2
    WHERE id = $1
    RETURNING
      id,
      victory_world_target_address
    `,
    [
      userId,
      targetAddress
    ]
  );

  return result.rows[0] || null;
}

async function validateVictoryWorld(
  userId,
  txHash
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      victory_world_status = 'validated',
      victory_world_tx_hash = $2,
      victory_world_paid_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      victory_world_link,
      victory_world_status,
      victory_world_tx_hash,
      victory_world_paid_at,
      victory_world_started_at,
      victory_world_assigned_link,
      victory_world_target_address
    `,
    [
      userId,
      txHash
    ]
  );

  return result.rows[0] || null;
}

async function findNextOpportunity(
  currentOrderPosition
) {
  const result = await db.query(
    `
    SELECT
      id,
      name,
      slug,
      order_position,
      entry_url
    FROM opportunities
    WHERE
      active = true
      AND order_position > $1
    ORDER BY order_position ASC
    LIMIT 1
    `,
    [currentOrderPosition]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserById,
  findPaymentByHash,
  findVictoryWorldSponsorLink,
  saveAssignedVictoryWorldLink,
  findUserByVictoryWorldLink,
  saveVictoryWorldLink,
  saveVictoryWorldPayment,
  saveVictoryWorldTargetAddress,
  validateVictoryWorld,
  findNextOpportunity
};