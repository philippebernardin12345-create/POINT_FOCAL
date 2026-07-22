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
      victory_world_paid_at
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
      victory_world_paid_at = NULL
    WHERE id = $1
    RETURNING
      id,
      victory_world_link,
      victory_world_status
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
      victory_world_paid_at
    `,
    [
      userId,
      txHash
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserById,
  findPaymentByHash,
  saveVictoryWorldLink,
  saveVictoryWorldPayment,
  validateVictoryWorld
};
