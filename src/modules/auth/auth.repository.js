const db = require("../../config/db");

async function findUserByEmail(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  return result.rows[0];
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
    `SELECT * FROM users
     WHERE invitation_code_series_1 = $1
        OR invitation_code_series_2 = $1
     LIMIT 1`,
    [code]
  );
  return result.rows[0];
}

async function getActiveCampaign() {
  const result = await db.query(
    "SELECT * FROM campaigns WHERE status = 'active' LIMIT 1"
  );
  return result.rows[0];
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
      is_root,
      is_leader,
      link_active,
      email_confirmed
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,false,true,false)
    RETURNING id, email, whatsapp, language, status, sponsor_id, campaign_id,
              invitation_code_series_1, invitation_code_series_2,
              is_root, is_leader, link_active, email_confirmed, created_at`,
    [
      user.email,
      user.whatsapp,
      user.passwordHash,
      user.language,
      user.status,
      user.sponsorId,
      user.campaignId,
      user.invitationCodeSeries1
    ]
  );

  return result.rows[0];
}

async function confirmEmail(userId) {
  const result = await db.query(
    `UPDATE users
     SET email_confirmed = true, status = 'active'
     WHERE id = $1
     RETURNING id, email, status, email_confirmed`,
    [userId]
  );

  return result.rows[0];
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByInvitationCode,
  getActiveCampaign,
  createUser,
  confirmEmail
};