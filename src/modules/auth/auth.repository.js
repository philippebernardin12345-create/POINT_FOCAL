const db = require("../../config/db");

function runQuery(client, text, params = []) {
  return (client || db).query(text, params);
}

async function findUserByEmail(email, options = {}) {
  const result = await runQuery(
    options.client,
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  return result.rows[0] || null;
}

async function findUserById(id, options = {}) {
  const result = await runQuery(
    options.client,
    "SELECT * FROM users WHERE id = $1 LIMIT 1",
    [id]
  );

  return result.rows[0] || null;
}

async function findUserByInvitationCode(code, options = {}) {
  const result = await runQuery(
    options.client,
    `SELECT *
     FROM users
     WHERE invitation_code = $1
     LIMIT 1`,
    [code]
  );

  return result.rows[0] || null;
}

async function getActiveCampaign(options = {}) {
  const result = await runQuery(
    options.client,
    "SELECT * FROM campaigns WHERE status = 'active' LIMIT 1"
  );

  return result.rows[0] || null;
}

async function findRootUser(options = {}) {
  const lockClause = options.forUpdate
    ? "FOR UPDATE"
    : "";

  const result = await runQuery(
    options.client,
    `
    SELECT u.*
    FROM v106_runtime_state state
    JOIN users u
      ON u.id = state.root_user_id
    WHERE state.singleton_id = true
      AND state.root_user_id IS NOT NULL
    LIMIT 1
    ${lockClause}
    `
  );

  return result.rows[0] || null;
}

async function createUser(user, options = {}) {
  const result = await runQuery(
    options.client,
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
      $8,
      $9,
      $10,
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
      user.campaignId,
      user.isLeader === true,
      user.isPrelaunchLeader === true,
      user.linkActive === true
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

async function confirmEmailByOtp(email, otp, options = {}) {
  const client = options.client;

  const result = await (client || db).query(
    `
    WITH confirmed AS (
      UPDATE users
      SET
        email_confirmed = true,
        status = 'active',
        email_otp = NULL,
        email_otp_expires_at = NULL
      WHERE email = $1
        AND email_otp = $2
        AND email_otp_expires_at > NOW()
      RETURNING *
    ),
    leader_slot AS (
      SELECT
        EXISTS (
          SELECT 1
          FROM confirmed
        ) AS confirmed_ok,
        (
          SELECT leader_threshold
          FROM v106_runtime_state
          WHERE singleton_id = true
          FOR UPDATE
        ) AS leader_threshold,
        (
          SELECT COUNT(*)::int
          FROM users
          WHERE is_leader = true
            AND is_prelaunch_leader = true
            AND email_confirmed = true
            AND status = 'active'
        ) AS current_leaders
    ),
    promoted AS (
      UPDATE users u
      SET
        is_leader = true,
        is_prelaunch_leader = true,
        link_active = false
      FROM confirmed c, leader_slot l
      WHERE u.id = c.id
        AND l.confirmed_ok = true
        AND l.current_leaders < l.leader_threshold
      RETURNING u.*
    )
    SELECT
      id,
      email,
      status,
      email_confirmed,
      is_leader,
      is_prelaunch_leader,
      link_active
    FROM promoted

    UNION ALL

    SELECT
      id,
      email,
      status,
      email_confirmed,
      is_leader,
      is_prelaunch_leader,
      link_active
    FROM confirmed
    WHERE NOT EXISTS (
      SELECT 1 FROM promoted
    )
    LIMIT 1
    `,
    [email, otp]
  );

  return result.rows[0] || null;
}

async function countRootLeaders() {
  const result = await runQuery(
    null,
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_leader = true
      AND is_prelaunch_leader = true
      AND email_confirmed = true
      AND status = 'active'
      AND sponsor_id = (
        SELECT root_user_id
        FROM v106_runtime_state
        WHERE singleton_id = true
          AND root_user_id IS NOT NULL
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
async function findOldestAvailableSponsorForFifo(options = {}) {
  const client = options.client || null;
  const lockClause = client
    ? "FOR UPDATE OF u SKIP LOCKED"
    : "";

  const result = await runQuery(
    client,
    `
    WITH runtime AS (
      SELECT (
        SELECT root_user_id
        FROM v106_runtime_state
        WHERE singleton_id = true
        LIMIT 1
      ) AS root_user_id
    ),
    candidates AS (
      SELECT
        u.id,
        COALESCE(COUNT(gs.child_user_id), 0)::int AS total_referrals
      FROM users u
      LEFT JOIN v106_global_sponsorships gs
        ON gs.sponsor_user_id = u.id
      CROSS JOIN runtime
      WHERE u.link_active = true
        AND u.email_confirmed = true
        AND u.status = 'active'
        AND (
          runtime.root_user_id IS NULL
          OR u.id <> runtime.root_user_id
        )
      GROUP BY u.id
      HAVING COALESCE(COUNT(gs.child_user_id), 0) < 2
    )
    SELECT
      u.id,
      u.email,
      u.invitation_code,
      u.created_at,
      c.total_referrals
    FROM candidates c
    JOIN users u
      ON u.id = c.id
    ORDER BY u.created_at ASC, u.id ASC
    LIMIT 1
    ${lockClause}
    `
  );

  return result.rows[0] || null;
}
async function activatePrelaunchLeadersIfLimitReached(options = {}) {
  const client = options.client;

  const result = await runQuery(
    client,
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_leader = true
      AND is_prelaunch_leader = true
      AND email_confirmed = true
      AND status = 'active'
      AND sponsor_id = (
        SELECT root_user_id
        FROM v106_runtime_state
        WHERE singleton_id = true
          AND root_user_id IS NOT NULL
        LIMIT 1
      )
    `
  );

  const total = result.rows[0]?.total || 0;

  if (total < 50) {
    return {
      activated: false,
      total,
      activatedCount: 0
    };
  }

  const activation = await runQuery(
    client,
    `
    UPDATE users
    SET
      is_prelaunch_leader = false,
      link_active = true
    WHERE is_leader = true
      AND is_prelaunch_leader = true
      AND link_active = false
      AND sponsor_id = (
        SELECT root_user_id
        FROM v106_runtime_state
        WHERE singleton_id = true
          AND root_user_id IS NOT NULL
        LIMIT 1
      )
    RETURNING id
    `
  );

  return {
    activated: true,
    total,
    activatedCount: activation.rows.length
  };
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
  findRootUser,
  createUser,
  saveEmailOtp,
  confirmEmail,
  confirmEmailByOtp,
  countRootLeaders,
  countPrelaunchLeaders,
  findOldestAvailableSponsorForFifo,

  activatePrelaunchLeadersIfLimitReached,
  savePasswordResetToken,
  findUserByPasswordResetToken,
  updatePasswordAndClearResetToken
};
