const db = require("../../config/db");

async function markVictoryAssigned(userId) {
  const result = await db.query(
    `UPDATE users
     SET victory_assigned_at = COALESCE(victory_assigned_at, NOW())
     WHERE id = $1
     RETURNING victory_assigned_at`,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  markVictoryAssigned
};