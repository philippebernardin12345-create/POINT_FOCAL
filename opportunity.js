const pool = require("../db");

exports.add = async (req, res) => {

  const { userId, opportunityId, link } = JSON.parse(req.body || "{}");

  await pool.query(
    `INSERT INTO opportunities(user_id, opportunity_id, referral_link)
     VALUES($1,$2,$3)`,
    [userId, opportunityId, link]
  );

  res.end(JSON.stringify({ ok: true }));
};