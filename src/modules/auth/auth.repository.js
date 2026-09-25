const db = require("../../config/db");

async function findUserByEmail(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await db.query(
    "SELECT * FROM users WHERE id = $1 LIMIT 1",
    [id]
  );

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}

async function findUserByInvitationCode(code, options = {}) {
  const client = options.client;
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  const lockClause = client ? "FOR UPDATE" : "";

  const result = await (client || db).query(
    `
    SELECT *
    FROM users
    WHERE invitation_code = $1
    LIMIT 1
    ${lockClause}
    `,
    [normalizedCode]
  );

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}


async function getActiveCampaign() {
  const result = await db.query(
    "SELECT * FROM campaigns WHERE status = 'active' LIMIT 1"
  );

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}


async function findRootUser() {
  const result = await db.query(
    `
      SELECT u.*
      FROM users u
      JOIN v106_runtime_state rs
        ON rs.root_user_id = u.id
      WHERE rs.singleton_id = true
      LIMIT 1
    `
  );
  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}


async function createUser(user, options = {}) {
  const client = options.client || db;

  const result = await client.query(
    `
    INSERT INTO users (
      email,
      whatsapp,
      password_hash,
      language,
      status,
      sponsor_id,
      campaign_id,
      invitation_code,
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
      $8,
      false,
      $9,
      $10,
      $11,
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
      invitation_code,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
      created_at
    `,
    [
      user.email,
      user.whatsapp,
      user.passwordHash,
      user.language,
      user.status,
      user.sponsorId,
      user.campaignId,
      user.invitationCode,
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

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

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

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}

async function confirmEmailByOtp(email, otp, options = {}) {
  const client = options.client;

  const result = await (client || db).query(
    `
    WITH runtime AS (
      SELECT
        phase,
        root_user_id,
        leader_threshold
      FROM v106_runtime_state
      WHERE singleton_id = true
      FOR UPDATE
    ),
    leader_count AS (
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE is_leader = true
        AND is_prelaunch_leader = true
        AND email_confirmed = true
        AND lower(coalesce(status, '')) = 'active'
    )
    UPDATE users u
    SET
      email_confirmed = true,
      status = 'active',
      email_otp = NULL,
      email_otp_expires_at = NULL,

      is_leader = CASE
        WHEN runtime.phase = 'LEADER_LAUNCH'
          AND u.sponsor_id = runtime.root_user_id
          AND leader_count.total < runtime.leader_threshold
        THEN true
        ELSE u.is_leader
      END,

      is_prelaunch_leader = CASE
        WHEN runtime.phase = 'LEADER_LAUNCH'
          AND u.sponsor_id = runtime.root_user_id
          AND leader_count.total < runtime.leader_threshold
        THEN true
        ELSE u.is_prelaunch_leader
      END,

      link_active = CASE
        WHEN runtime.phase = 'LEADER_LAUNCH'
          AND u.sponsor_id = runtime.root_user_id
          AND leader_count.total < runtime.leader_threshold
        THEN false
        ELSE u.link_active
      END

    FROM runtime, leader_count

    WHERE u.email = $1
      AND u.email_otp = $2
      AND u.email_otp_expires_at > NOW()

    RETURNING
      u.id,
      u.email,
      u.status,
      u.email_confirmed,
      u.is_leader,
      u.is_prelaunch_leader,
      u.link_active
    `,
    [email, otp]
  );

  console.log("[AUTH-DIAG]", {
    found: !!result.rows[0],
    emailConfirmed:
      result.rows[0]?.email_confirmed,
    status:
      result.rows[0]?.status
  });

  return result.rows[0] || null;
}

async function countRootLeaders() {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_leader = true
      AND is_prelaunch_leader = true
      AND email_confirmed = true
      AND status = 'active'
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
      AND email_confirmed = true
      AND status = 'active'
    `
  );

  return result.rows[0]?.total || 0;
}

async function findOldestAvailableSponsorForFifo(options = {}) {
  const client = options.client;
  const runner = client || db;
  const excludedIds = [];

  while (true) {
    const candidateResult = await runner.query(
      `
        SELECT u.id
        FROM users u
        WHERE u.id <> (
          SELECT root_user_id
          FROM v106_runtime_state
          WHERE singleton_id = true
        )
          AND u.link_active = true
          AND u.email_confirmed = true
          AND u.status = 'active'
          AND NOT (u.id = ANY($1::uuid[]))
          AND (
            SELECT COUNT(*)
            FROM v106_global_sponsorships gs
            WHERE gs.sponsor_user_id = u.id
          ) < 2
        ORDER BY u.created_at ASC, u.id ASC
        LIMIT 1
      `,
      [excludedIds]
    );

    if (candidateResult.rows.length === 0) {
      return null;
    }

    const candidateId = candidateResult.rows[0].id;

    const lockedResult = await runner.query(
      `
        SELECT
          id,
          email,
          invitation_code,
          created_at
        FROM users
        WHERE id = $1
          AND id <> (
            SELECT root_user_id
            FROM v106_runtime_state
            WHERE singleton_id = true
          )
          AND link_active = true
          AND email_confirmed = true
          AND status = 'active'
        FOR UPDATE
      `,
      [candidateId]
    );

    if (lockedResult.rows.length === 0) {
      excludedIds.push(candidateId);
      continue;
    }

    const capacityResult = await runner.query(
      `
        SELECT COUNT(*)::int AS total_referrals
        FROM v106_global_sponsorships
        WHERE sponsor_user_id = $1
      `,
      [candidateId]
    );

    const totalReferrals =
      capacityResult.rows[0]?.total_referrals ?? 0;

    if (totalReferrals < 2) {
      return {
        ...lockedResult.rows[0],
        total_referrals: totalReferrals
      };
    }

    excludedIds.push(candidateId);
  }
}

async function activatePrelaunchLeadersIfLimitReached(options = {}) {
  const client = options.client;

  const result = await (client || db).query(
    `
    SELECT
      rs.phase,
      rs.leader_count,
      rs.leader_threshold
    FROM v106_runtime_state rs
    WHERE rs.singleton_id = true
    FOR UPDATE
    `
  );

  const state = result.rows[0];

  if (!state) {
    throw new Error("V106_RUNTIME_STATE_NOT_CONFIGURED");
  }

  if (state.phase !== "NORMAL_OPERATION") {
    return {
      activated: false,
      total: state.leader_count,
      activatedCount: 0
    };
  }

  const activation = await (client || db).query(
    `
    UPDATE users
    SET
      is_prelaunch_leader = false,
      link_active = true
    WHERE is_leader = true
      AND is_prelaunch_leader = true
      AND email_confirmed = true
      AND status = 'active'
      AND link_active = false
    RETURNING id
    `
  );

  return {
    activated: activation.rows.length > 0,
    total: state.leader_count,
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

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

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

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

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

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

  return result.rows[0] || null;
}


async function promoteConfirmedRootSponsoredLeader(userId, options = {}) {
  const client = options.client;

  const result = await (client || db).query(`
    UPDATE users u
    SET
      is_leader = true,
      is_prelaunch_leader = true,
      link_active = false
    WHERE u.id = $1
      AND u.email_confirmed = true
      AND lower(coalesce(u.status, '')) = 'active'
      AND u.sponsor_id = (
        SELECT root_user_id
        FROM v106_runtime_state
        WHERE singleton_id = true
      )
      AND (
        SELECT COUNT(*)::int
        FROM users
        WHERE is_leader = true
          AND is_prelaunch_leader = true
          AND email_confirmed = true
          AND lower(coalesce(status, '')) = 'active'
      ) < (
        SELECT leader_threshold
        FROM v106_runtime_state
        WHERE singleton_id = true
      )
    RETURNING
      id,
      email,
      status,
      email_confirmed,
      is_leader,
      is_prelaunch_leader,
      link_active
  `, [userId]);

  console.log("[AUTH-DIAG]", { found: !!result.rows[0], emailConfirmed: result.rows[0]?.email_confirmed, status: result.rows[0]?.status });

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
  promoteConfirmedRootSponsoredLeader,
  countRootLeaders,
  countPrelaunchLeaders,
  findOldestAvailableSponsorForFifo,

  activatePrelaunchLeadersIfLimitReached,
  savePasswordResetToken,
  findUserByPasswordResetToken,
  updatePasswordAndClearResetToken
};
