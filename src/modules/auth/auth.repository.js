const db = require("../../config/db");

async function findUserByEmail(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await db.query(
    "SELECT * FROM users WHERE id = $1 LIMIT 1",
    [id]
  );

  return result.rows[0] || null;
}

async function findUserByInvitationCode(code) {
  const result = await db.query(
    `SELECT *
     FROM users
     WHERE invitation_code_series_1 = $1
        OR invitation_code_series_2 = $1
        OR invitation_code_series_3 = $1
     LIMIT 1`,
    [code]
  );

  return result.rows[0] || null;
}

async function getActiveCampaign() {
  const result = await db.query(
    "SELECT * FROM campaigns WHERE status = 'active' LIMIT 1"
  );

  return result.rows[0] || null;
}

async function createUser(user) {
  const result = await db.query(
    `INSERT INTO users (
      email,
      whatsapp,
      password_hash,
      language,
      status,
      sponsor_id,
      campaign_id,
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      NULL,
      NULL,
      NULL,
      false,
      false,
      false,
      false,
      false
    )
    RETURNING
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      campaign_id,
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
      created_at`,
    [
      user.email,
      user.whatsapp,
      user.passwordHash,
      user.language,
      user.status,
      user.sponsorId,
      user.campaignId
    ]
  );

  return result.rows[0];
}

async function saveEmailOtp(userId, otp, expiresAt) {
  const result = await db.query(
    `UPDATE users
     SET email_otp = $1,
         email_otp_expires_at = $2
     WHERE id = $3
     RETURNING id, email, email_otp, email_otp_expires_at`,
    [otp, expiresAt, userId]
  );

  return result.rows[0] || null;
}

async function confirmEmail(userId) {
  const result = await db.query(
    `UPDATE users
     SET email_confirmed = true,
         status = 'active',
         email_otp = NULL,
         email_otp_expires_at = NULL
     WHERE id = $1
     RETURNING id, email, status, email_confirmed`,
    [userId]
  );

  return result.rows[0] || null;
}

async function confirmEmailByOtp(email, otp) {
  const result = await db.query(
    `UPDATE users
     SET email_confirmed = true,
         status = 'active',
         email_otp = NULL,
         email_otp_expires_at = NULL
     WHERE email = $1
       AND email_otp = $2
       AND email_otp_expires_at > NOW()
     RETURNING id, email, status, email_confirmed`,
    [email, otp]
  );

  return result.rows[0] || null;
}

async function countRootLeaders() {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_leader = true
      AND sponsor_id = (
        SELECT id
        FROM users
        WHERE is_root = true
        LIMIT 1
      )
    `
  );

  return result.rows[0]?.total || 0;
}

async function countPrelaunchLeaders() {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_prelaunch_leader = true
    `
  );

  return result.rows[0]?.total || 0;
}
async function findOldestAvailableSponsorForFifo() {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.email,
      u.invitation_code_series_1,
      u.created_at,
      COUNT(children.id)::int AS total_referrals
    FROM users u
    LEFT JOIN users children
      ON children.sponsor_id = u.id
    WHERE u.is_root = false
      AND u.link_active = true
      AND u.email_confirmed = true
      AND u.status = 'active'
    GROUP BY
      u.id,
      u.email,
      u.invitation_code_series_1,
      u.created_at
    HAVING COUNT(children.id) < 2
    ORDER BY u.created_at ASC
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}
async function savePasswordResetToken(
  userId,
  resetTokenHash,
  expiresAt
) {
  const result = await db.query(
    `
    UPDATE users
    SET password_reset_token = $1,
        password_reset_expires_at = $2
    WHERE id = $3
    RETURNING
      id,
      email,
      password_reset_expires_at
    `,
    [
      resetTokenHash,
      expiresAt,
      userId
    ]
  );

  return result.rows[0] || null;
}

async function findUserByPasswordResetToken(
  resetTokenHash
) {
  const result = await db.query(
    `
    SELECT *
    FROM users
    WHERE password_reset_token = $1
      AND password_reset_expires_at > NOW()
    LIMIT 1
    `,
    [resetTokenHash]
  );

  return result.rows[0] || null;
}

async function updatePasswordAndClearResetToken(
  userId,
  passwordHash
) {
  const result = await db.query(
    `
    UPDATE users
    SET password_hash = $1,
        password_reset_token = NULL,
        password_reset_expires_at = NULL
    WHERE id = $2
    RETURNING
      id,
      email
    `,
    [
      passwordHash,
      userId
    ]
  );

  return result.rows[0] || null;
}
module.exports = {
  findUserByEmail,
  findUserById,
  findUserByInvitationCode,
  getActiveCampaign,
  createUser,
  saveEmailOtp,
  confirmEmail,
  confirmEmailByOtp,
  countRootLeaders,
  countPrelaunchLeaders,
  findOldestAvailableSponsorForFifo,
  savePasswordResetToken,
  findUserByPasswordResetToken,
  updatePasswordAndClearResetToken
};