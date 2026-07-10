const db = require("../../config/db");

async function findUserBySeries3Code(code) {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      invitation_code_series_3
    FROM users
    WHERE invitation_code_series_3 = $1
    LIMIT 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

async function findUserPaymentStart(userId) {
  const result = await db.query(
    `
    SELECT
      victory_assigned_at
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
      id
    FROM payments
    WHERE tx_hash = $1
    LIMIT 1
    `,
    [txHash]
  );

  return result.rows[0] || null;
}

async function savePayment(userId, txHash, targetAddress, amount) {
  const result = await db.query(
    `
    INSERT INTO payments (
      user_id,
      tx_hash,
      target_address,
      amount
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [
      userId,
      txHash,
      targetAddress,
      amount
    ]
  );

  return result.rows[0];
}

module.exports = {
  findUserBySeries3Code,
  findUserPaymentStart,
  findPaymentByHash,
  savePayment
};