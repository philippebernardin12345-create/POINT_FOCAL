const db = require("../../config/db");

async function markVictoryAssigned(userId, startedAt, expiresAt) {
  const result = await db.query(
    `UPDATE users
     SET victory_assigned_at = COALESCE(victory_assigned_at, NOW()),
         victory_started_at = COALESCE(victory_started_at, $2),
         victory_expires_at = COALESCE(victory_expires_at, $3)
     WHERE id = $1
     RETURNING
       id,
       victory_assigned_at,
       victory_started_at,
       victory_expires_at,
       victory_expired,
       status,
       link_active`,
    [userId, startedAt, expiresAt]
  );

  return result.rows[0] || null;
}

async function reactivateVictoryUser(userId) {
  const result = await db.query(
    `UPDATE users
     SET status = 'active',
         victory_expired = false,
         link_active = false,
         victory_started_at = NOW(),
         victory_expires_at = NOW() + INTERVAL '24 hours',
         victory_assigned_at = NOW()
     WHERE id = $1
       AND (
         victory_expired = true
         OR status = 'expired'
       )
     RETURNING
       id,
       email,
       status,
       victory_started_at,
       victory_expires_at,
       victory_expired,
       link_active`,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  markVictoryAssigned,
  reactivateVictoryUser
};