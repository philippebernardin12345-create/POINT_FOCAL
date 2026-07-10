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
      victory_assigned_at,
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

async function activatePointFocalLink(
  userId,
  invitationCodeSeries1,
  invitationCodeSeries2,
  invitationCodeSeries3
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
      invitation_code_series_2 =
        COALESCE(
          invitation_code_series_2,
          $3
        ),
      invitation_code_series_3 =
        COALESCE(
          invitation_code_series_3,
          $4
        ),
      link_active = true
    WHERE id = $1
    RETURNING
      id,
      email,
      victory_personal_link,
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
      link_active
    `,
    [
      userId,
      invitationCodeSeries1,
      invitationCodeSeries2,
      invitationCodeSeries3
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserBySeries3Code,
  findUserByInvitationCode,
  findUserPaymentStart,
  findPaymentByHash,
  savePayment,
  saveVictoryPersonalLink,
  activatePointFocalLink
};
