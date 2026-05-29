const pool = require("../db");

exports.init = async (req, res) => {

  const { email, parrain } = JSON.parse(req.body || "{}");

  await pool.query(
    `INSERT INTO users(email, parrain_id, state, created_at)
     VALUES($1,$2,1,NOW())`,
    [email, parrain || null]
  );

  res.end(JSON.stringify({ ok: true }));
};