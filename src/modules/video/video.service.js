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
  let session = await videoRepository.findVideoStateByUserId(userId);

  if (!session) {
    session = await videoRepository.createVideoSession(userId);
  }

  /*
   * Une vidéo déjà validée est définitive.
   * Aucun nouvel appel ne peut la remettre à zéro
   * ou la rendre incomplète.
   */
  if (session.is_completed === true) {
    return formatVideoSession(session);
  }

  const clientSeconds = Math.max(
    0,
    Math.floor(Number(watchedSeconds) || 0)
  );

  const startedAtMs = new Date(session.started_at).getTime();

  if (!Number.isFinite(startedAtMs)) {
    throw new Error("Session vidéo invalide.");
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - startedAtMs) / 1000)
  );

  /*
   * Le navigateur ne peut pas déclarer plus de temps
   * que le temps réellement écoulé côté serveur.
   */
  const verifiedSeconds = Math.min(
    clientSeconds,
    elapsedSeconds,
    VIDEO_REQUIRED_SECONDS
  );

  const isCompleted =
    verifiedSeconds >= VIDEO_REQUIRED_SECONDS;

  session = await videoRepository.updateVideoProgress(
    userId,
    verifiedSeconds,
    isCompleted
  );

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
  updateProgress
};