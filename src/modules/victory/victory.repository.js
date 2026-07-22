const db = require("../../config/db");

async function findUserWithSponsor(userId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.email,
      u.status,
      u.sponsor_id,
      u.victory_assigned_at,
      u.victory_started_at,
      u.victory_expires_at,
      u.victory_expired,
      u.victory_personal_link,
      u.link_active,

      sponsor.id AS sponsor_user_id,
      sponsor.email AS sponsor_email,
      sponsor.victory_personal_link AS sponsor_victory_link

    FROM users u

    LEFT JOIN users sponsor
      ON sponsor.id = u.sponsor_id

    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findOldestAvailableVictorySponsor(
  excludedSponsorId = null
) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.email,
      u.victory_personal_link,
      u.created_at,
      COUNT(children.id)::int AS total_referrals

    FROM users u

    LEFT JOIN users children
      ON children.sponsor_id = u.id

    WHERE u.is_root = false
      AND u.status = 'active'
      AND u.email_confirmed = true
      AND u.link_active = true
      AND u.victory_personal_link IS NOT NULL
      AND u.victory_personal_link <> ''
      AND (
        $1::uuid IS NULL
        OR u.id <> $1::uuid
      )

    GROUP BY
      u.id,
      u.email,
      u.victory_personal_link,
      u.created_at

    HAVING COUNT(children.id) < 2

    ORDER BY u.created_at ASC

    LIMIT 1
    `,
    [excludedSponsorId]
  );

  return result.rows[0] || null;
}

async function findRootVictoryLink() {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      victory_personal_link
    FROM users
    WHERE is_root = true
      AND victory_personal_link IS NOT NULL
      AND victory_personal_link <> ''
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function findVictoryOpportunityRootLink() {
  const result = await db.query(
    `
    SELECT
      id,
      name,
      root_sponsor_link
    FROM opportunities
    WHERE position = 1
      AND is_active = true
      AND root_sponsor_link IS NOT NULL
      AND root_sponsor_link <> ''
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function markVictoryAssigned(
  userId,
  startedAt,
  expiresAt
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      victory_assigned_at =
        COALESCE(victory_assigned_at, NOW()),

      victory_started_at =
        COALESCE(victory_started_at, $2),

      victory_expires_at =
        COALESCE(victory_expires_at, $3)

    WHERE id = $1

    RETURNING
      id,
      email,
      status,
      sponsor_id,
      victory_assigned_at,
      victory_started_at,
      victory_expires_at,
      victory_expired,
      victory_personal_link,
      link_active
    `,
    [
      userId,
      startedAt,
      expiresAt
    ]
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
      victory_assigned_at = NOW(),
      victory_started_at = NOW(),
      victory_expires_at =
        NOW() + INTERVAL '24 hours'

    WHERE id = $1
      AND (
        victory_expired = true
        OR status = 'expired'
      )

    RETURNING
      id,
      email,
      status,
      sponsor_id,
      victory_assigned_at,
      victory_started_at,
      victory_expires_at,
      victory_expired,
      victory_personal_link,
      link_active
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function saveVictoryParentIdentifier(
  userId,
  victoryParentIdentifier
) {
  const result = await db.query(
    `
    UPDATE users
    SET victory_parent_identifier = $2
    WHERE id = $1
    RETURNING
      id,
      victory_parent_identifier
    `,
    [
      userId,
      victoryParentIdentifier
    ]
  );

  return result.rows[0] || null;
}

async function saveVictoryPersonalLink(
  userId,
  victoryPersonalLink
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      victory_personal_link = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      email,
      sponsor_id,
      victory_parent_identifier,
      victory_personal_link,
      victory_started_at,
      victory_expires_at,
      victory_expired,
      link_active
    `,
    [
      userId,
      victoryPersonalLink
    ]
  );

  return result.rows[0] || null;
}

async function findUserByVictoryPersonalLink(
  victoryPersonalLink
) {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      sponsor_id,
      victory_parent_identifier,
      victory_personal_link,
      link_active
    FROM users
    WHERE victory_personal_link = $1
    LIMIT 1
    `,
    [victoryPersonalLink]
  );

  return result.rows[0] || null;
}
module.exports = {
  findUserWithSponsor,
  findOldestAvailableVictorySponsor,
  findRootVictoryLink,
  findVictoryOpportunityRootLink,
  markVictoryAssigned,
  reactivateVictoryUser,
  saveVictoryParentIdentifier,
  saveVictoryPersonalLink,
  findUserByVictoryPersonalLink
};