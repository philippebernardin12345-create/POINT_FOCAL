const db = require("../../config/db");

async function findUserById(userId) {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      campaign_id,
        sponsor_id,
        is_root,
        status,
      victory_world_link,
      victory_world_status,
      victory_world_tx_hash,
      victory_world_paid_at,
      victory_world_started_at,
      victory_world_assigned_link,
      victory_world_target_address
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findVictoryWorldStructuralSponsor(
  sponsorId
) {
  if (!sponsorId) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      id,
      email,
      status,
      victory_world_status,
      victory_world_link
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [sponsorId]
  );

  return result.rows[0] || null;
}

async function findVictoryWorldRootLink() {
  const result = await db.query(
    `
    SELECT
      value AS victory_world_link
    FROM system_settings
    WHERE key = 'victory_world_root_link'
      AND value IS NOT NULL
      AND value <> ''
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function saveAssignedVictoryWorldLink(
  userId,
  assignedLink
) {
  const result = await db.query(
    `
    UPDATE users
    SET victory_world_assigned_link = $2
    WHERE id = $1
    RETURNING
      id,
      victory_world_assigned_link
    `,
    [
      userId,
      assignedLink
    ]
  );

  return result.rows[0] || null;
}

async function findUserByVictoryWorldLink(
  victoryWorldLink
) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.email,
      CASE
        WHEN u.victory_world_link = $1
          THEN u.victory_world_link
        ELSE $1
      END AS victory_world_link,
      u.victory_world_status
    FROM users u
    WHERE
      u.victory_world_link = $1
      OR (
        u.is_root = true
        AND $1 = (
          SELECT value
          FROM system_settings
          WHERE key = 'victory_world_root_link'
          LIMIT 1
        )
      )
    ORDER BY
      CASE
        WHEN u.victory_world_link = $1 THEN 0
        ELSE 1
      END
    LIMIT 1
    `,
    [victoryWorldLink]
  );

  return result.rows[0] || null;
}

async function saveVictoryWorldLink(
  userId,
  victoryWorldLink
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      victory_world_link = $2,
      victory_world_status = 'validated',
      victory_world_tx_hash = NULL,
      victory_world_paid_at = NULL,
      victory_world_target_address = NULL,
        victory_world_started_at = COALESCE(victory_world_started_at, NOW())
    WHERE id = $1
    RETURNING
      id,
      victory_world_link,
      victory_world_status,
      victory_world_started_at,
      victory_world_assigned_link
    `,
    [
      userId,
      victoryWorldLink
    ]
  );

  return result.rows[0] || null;
}

async function findNextOpportunity(
  currentPosition
) {
  const result = await db.query(
    `
    SELECT
      id,
      name,
      slug,
      position,
      entry_url,
      opportunity_url
    FROM opportunities
    WHERE
      upper(coalesce(status, '')) = 'ACTIVE'
      AND position > $1
      AND (
        NULLIF(TRIM(entry_url), '') IS NOT NULL
        OR NULLIF(TRIM(opportunity_url), '') IS NOT NULL
      )
    ORDER BY position ASC
    LIMIT 1
    `,
    [currentPosition]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserById,
  findVictoryWorldStructuralSponsor,
  findVictoryWorldRootLink,
  saveAssignedVictoryWorldLink,
  findUserByVictoryWorldLink,
  saveVictoryWorldLink,
  findNextOpportunity
};