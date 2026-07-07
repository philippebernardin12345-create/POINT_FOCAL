const db = require("../../config/db");

async function findUserBySeries3Code(code) {
  const result = await db.query(
    `SELECT id, email, invitation_code_series_3
     FROM users
     WHERE invitation_code_series_3 = $1
     LIMIT 1`,
    [code]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserBySeries3Code
};