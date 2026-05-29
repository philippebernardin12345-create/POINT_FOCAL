const pool = require("../db");
const config = require("../config");

setInterval(async () => {

  const expired = await pool.query(`
    SELECT id FROM users
    WHERE state != 5
    AND created_at < NOW() - INTERVAL '48 hours'
  `);

  for (let user of expired.rows) {

    await pool.query(
      "UPDATE users SET state=7 WHERE id=$1",
      [user.id]
    );
  }

}, 3600000);