const pool = require("../db");

exports.start = async (req, res) => {
  const userId = "auth-user";

  await pool.query(
    "INSERT INTO video_sessions(user_id, started_at, status) VALUES($1, NOW(), 'locked')",
    [userId]
  );

  res.end(JSON.stringify({ ok: true }));
};

exports.complete = async (req, res) => {
  const userId = "auth-user";

  await pool.query(
    "UPDATE video_sessions SET status='done', completed_at=NOW() WHERE user_id=$1",
    [userId]
  );

  res.end(JSON.stringify({ ok: true }));
};