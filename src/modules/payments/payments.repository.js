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

async function findUserByInvitationCode(code) {
  const result = await db.query(
    `
    SELECT id
    FROM users
    WHERE invitation_code_series_1 = $1
       OR invitation_code_series_2 = $1
       OR invitation_code_series_3 = $1
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
      id,
      email,
      status,
      victory_assigned_at,
      victory_started_at,
      victory_expires_at,
      victory_expired,
      victory_personal_link,
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
      link_active
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function markUserVictoryExpired(userId) {
  const result = await db.query(
    `
    UPDATE users
    SET
      status = 'expired',
      victory_expired = true,
      link_active = false
    WHERE id = $1
    RETURNING
      id,
      email,
      status,
      victory_expired,
      victory_expires_at,
      link_active
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function reactivateVictoryUser(userId) {
  const result = await db.query(
    `
    UPDATE users
    SET
      status = 'active',
      victory_expired = false,
      link_active = false,
      victory_started_at = NOW(),
      victory_expires_at = NOW() + INTERVAL '24 hours',
      victory_assigned_at = NOW()
    WHERE id = $1
      AND victory_expired = true
    RETURNING
      id,
      email,
      status,
      victory_started_at,
      victory_expires_at,
      victory_expired,
      link_active
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

async function savePayment(
  userId,
  txHash,
  targetAddress,
  amount
) {
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

  return result.rows[0] || null;
}

async function saveVictoryPersonalLink(
  userId,
  victoryLink
) {
  const result = await db.query(
    `
    UPDATE users
    SET victory_personal_link = $2
    WHERE id = $1
    RETURNING
      id,
      victory_personal_link
    `,
    [
      userId,
      victoryLink
    ]
  );

  return result.rows[0] || null;
}

async function activateSeries1PointFocalLink(
  userId,
  invitationCodeSeries1
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      invitation_code_series_1 =
        COALESCE(
          invitation_code_series_1,
          $2
        ),
      status = 'active',
      victory_expired = false,
      link_active = true
    WHERE id = $1
    RETURNING
      id,
      email,
      victory_personal_link,
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
      status,
      victory_expired,
      link_active
    `,
    [
      userId,
      invitationCodeSeries1
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserBySeries3Code,
  findUserByInvitationCode,
  findUserPaymentStart,
  markUserVictoryExpired,
  reactivateVictoryUser,
  findPaymentByHash,
  savePayment,
  saveVictoryPersonalLink,
  activateSeries1PointFocalLink
};