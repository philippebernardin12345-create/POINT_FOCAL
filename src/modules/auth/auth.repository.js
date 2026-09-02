const db = require("../../config/db");
const {
  generateInvitationCode,
  normalizeInvitationCode
} = require("../../utils/codeGenerator");

const ROOT_INVITATION_CODE = "ABCD1000";
const MAX_INVITATION_CODE_ATTEMPTS = 30;

function runQuery(client, text, params = []) {
  return db.query(text, params, client);
}

function isInvitationCodeUniqueViolation(error) {
  const details = [
    error?.constraint,
    error?.detail,
    error?.message
  ]
    .filter(Boolean)
    .join(" ");

  return error?.code === "23505" &&
    /invitation[_ ]code/i.test(details);
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
  const normalizedCode = normalizeInvitationCode(code);

  if (!normalizedCode) {
    return null;
  }

  const result = await runQuery(
    options.client,
    `
    SELECT *
    FROM users
    WHERE invitation_code = $1
    LIMIT 1
    `,
    [normalizedCode]
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

async function invitationCodeExists(code, options = {}) {
  const normalizedCode = normalizeInvitationCode(code);

  if (!normalizedCode) {
    return false;
  }

  const result = await runQuery(
    options.client,
    `
    SELECT 1
    FROM users
    WHERE invitation_code = $1
    LIMIT 1
    `,
    [normalizedCode]
  );

  return result.rows.length > 0;
}

async function generateUniqueInvitationCode(options = {}) {
  for (let attempt = 0; attempt < MAX_INVITATION_CODE_ATTEMPTS; attempt += 1) {
    const invitationCode = normalizeInvitationCode(
      generateInvitationCode()
    );

    if (
      invitationCode &&
      invitationCode !== ROOT_INVITATION_CODE &&
      !(await invitationCodeExists(invitationCode, options))
    ) {
      return invitationCode;
    }
  }

  throw new Error(
    "Impossible de générer un code d'invitation unique."
  );
}

async function createUser(user, options = {}) {
  const client = options.client;
  const providedInvitationCode = normalizeInvitationCode(
    user.invitationCode
  );

  for (
    let attempt = 0;
    attempt < MAX_INVITATION_CODE_ATTEMPTS;
    attempt += 1
  ) {
    const invitationCode = providedInvitationCode ||
      await generateUniqueInvitationCode({ client });

    try {
      const result = await runQuery(
        client,
        `INSERT INTO users (
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
          created_at`,
        [
          user.email,
          user.whatsapp,
          user.passwordHash,
          user.language,
          user.status,
          user.sponsorId,
          user.campaignId,
          invitationCode,
          user.isLeader === true,
          user.isPrelaunchLeader === true,
          user.linkActive === true
        ]
      );

      return result.rows[0];
    } catch (error) {
      if (!providedInvitationCode && isInvitationCodeUniqueViolation(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Impossible de créer le compte avec un code d'invitation unique."
  );
}

async function saveEmailOtp(userId, otp, expiresAt, options = {}) {
  const result = await runQuery(
    options.client,
    `UPDATE users
     SET email_otp = $1,
         email_otp_expires_at = $2
     WHERE id = $3
     RETURNING id, email, email_otp, email_otp_expires_at`,
    [otp, expiresAt, userId]
  );

  return result.rows[0] || null;
}

async function confirmEmail(userId, options = {}) {
  const result = await runQuery(
    options.client,
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
  const result = await runQuery(
    options.client,
    `
    WITH runtime_state AS (
      SELECT phase, leader_threshold
      FROM v106_runtime_state
      WHERE singleton_id = true
      FOR UPDATE
    ),
    confirmed AS (
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
        COALESCE(
          (SELECT phase FROM runtime_state),
          'NORMAL_OPERATION'
        ) AS current_phase,
        COALESCE(
          (SELECT leader_threshold FROM runtime_state),
          50
        ) AS leader_threshold,
        (
          SELECT COUNT(*)::int
          FROM users
          WHERE is_leader = true
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
        AND l.current_phase = 'LEADER_LAUNCH'
        AND l.current_leaders < l.leader_threshold
      RETURNING u.*
    )
    SELECT
      id,
      email,
      status,
      email_confirmed,
      sponsor_id,
      invitation_code,
      is_root,
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
      sponsor_id,
      invitation_code,
      is_root,
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

async function findOldestAvailableSponsorForFifo(options = {}) {
  const {
    client,
    excludeUserId = null,
    requireVictoryLink = false
  } = options;

  const result = await runQuery(
    client,
    `
    WITH candidate AS (
      SELECT
        u.id,
        u.email,
        u.invitation_code,
        u.victory_personal_link,
        u.created_at
      FROM users u
      WHERE u.is_root = false
        AND u.link_active = true
        AND u.email_confirmed = true
        AND u.status = 'active'
        AND ($1 IS NULL OR u.id <> $1)
        AND (
          $2 = false
          OR (
            u.victory_personal_link IS NOT NULL
            AND u.victory_personal_link <> ''
          )
        )
        AND (
          SELECT COUNT(*)
          FROM users children
          WHERE children.sponsor_id = u.id
        ) < 2
      ORDER BY u.created_at ASC, u.id ASC
      FOR UPDATE OF u SKIP LOCKED
      LIMIT 1
    )
    SELECT
      candidate.*,
      (
        SELECT COUNT(*)::int
        FROM users children
        WHERE children.sponsor_id = candidate.id
      ) AS total_referrals
    FROM candidate
    `,
    [
      excludeUserId,
      requireVictoryLink
    ]
  );

  return result.rows[0] || null;
}

async function activatePrelaunchLeadersIfLimitReached(options = {}) {
  const client = options.client;
  const stateResult = await runQuery(
    client,
    `
    SELECT phase
    FROM v106_runtime_state
    WHERE singleton_id = true
    LIMIT 1
    `
  );

  const phase = stateResult.rows[0]?.phase;

  if (phase !== "NORMAL_OPERATION") {
    return {
      activated: false,
      phase: phase || null,
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
      AND email_confirmed = true
      AND status = 'active'
    RETURNING id
    `
  );

  return {
    activated: activation.rows.length > 0,
    phase,
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
  invitationCodeExists,
  generateUniqueInvitationCode,
  createUser,
  saveEmailOtp,
  confirmEmail,
  confirmEmailByOtp,
  findOldestAvailableSponsorForFifo,
  activatePrelaunchLeadersIfLimitReached,
  savePasswordResetToken,
  findUserByPasswordResetToken,
  updatePasswordAndClearResetToken
};
