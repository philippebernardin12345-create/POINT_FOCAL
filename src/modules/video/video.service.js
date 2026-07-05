const videoRepository = require("./video.repository");

const VIDEO_REQUIRED_SECONDS = 200;

async function getOrCreateVideoSession(userId) {
  let session = await videoRepository.findVideoStateByUserId(userId);

  if (!session) {
    session = await videoRepository.createVideoSession(userId);
  }

  return formatVideoSession(session);
}

async function updateProgress(userId, watchedSeconds) {
  const safeSeconds = Math.max(0, Number(watchedSeconds) || 0);
  const isCompleted = safeSeconds >= VIDEO_REQUIRED_SECONDS;

  const session = await videoRepository.updateVideoProgress(
    userId,
    safeSeconds,
    isCompleted
  );

  return formatVideoSession(session);
}

async function resetSession(userId) {
  const session = await videoRepository.resetVideoSession(userId);
  return formatVideoSession(session);
}

function formatVideoSession(session) {
  if (!session) return null;

  return {
    id: session.id,
    userId: session.user_id,
    startedAt: session.started_at,
    watchedSeconds: session.watched_seconds,
    requiredSeconds: VIDEO_REQUIRED_SECONDS,
    remainingSeconds: Math.max(
      0,
      VIDEO_REQUIRED_SECONDS - Number(session.watched_seconds || 0)
    ),
    isCompleted: session.is_completed,
    completedAt: session.completed_at
  };
}

module.exports = {
  VIDEO_REQUIRED_SECONDS,
  getOrCreateVideoSession,
  updateProgress,
  resetSession
};