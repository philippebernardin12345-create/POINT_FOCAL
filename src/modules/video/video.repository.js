const db = require("../../config/db");

async function findVideoStateByUserId(userId) {
  const result = await db.query(
    `SELECT * FROM video_sessions WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function createVideoSession(userId) {
  const result = await db.query(
    `
    INSERT INTO video_sessions (
      user_id,
      started_at,
      watched_seconds,
      is_completed,
      completed_at
    )
    VALUES ($1, NOW(), 0, false, NULL)
    RETURNING *
    `,
    [userId]
  );

  return result.rows[0];
}

async function updateVideoProgress(userId, watchedSeconds, isCompleted) {
  const result = await db.query(
    `
    UPDATE video_sessions
    SET
      watched_seconds = $2,
      is_completed = $3,
      completed_at = CASE WHEN $3 = true THEN NOW() ELSE completed_at END,
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING *
    `,
    [userId, watchedSeconds, isCompleted]
  );

  return result.rows[0] || null;
}

async function resetVideoSession(userId) {
  const result = await db.query(
    `
    UPDATE video_sessions
    SET
      started_at = NOW(),
      watched_seconds = 0,
      is_completed = false,
      completed_at = NULL,
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findVideoStateByUserId,
  createVideoSession,
  updateVideoProgress,
  resetVideoSession
};