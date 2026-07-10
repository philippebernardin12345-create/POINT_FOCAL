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

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByInvitationCode,
  getActiveCampaign,
  createUser,
  saveEmailOtp,
  confirmEmail,
  confirmEmailByOtp
};