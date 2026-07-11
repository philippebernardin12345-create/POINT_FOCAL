const db = require("../../config/db");

async function markVictoryAssigned(userId, startedAt, expiresAt) {
  const result = await db.query(
    `UPDATE users
     SET victory_assigned_at = COALESCE(victory_assigned_at, NOW()),
         victory_started_at = COALESCE(victory_started_at, $2),
         victory_expires_at = COALESCE(victory_expires_at, $3)
     WHERE id = $1
     RETURNING
       victory_assigned_at,
       victory_started_at,
       victory_expires_at,
       victory_expired`,
    [userId, startedAt, expiresAt]
  );

  return result.rows[0] || null;
}

module.exports = {
  markVictoryAssigned
};