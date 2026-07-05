const videoService = require("./video.service");

async function getVideoSession(req, res) {
  try {
    const userId = req.user.id;

    const session = await videoService.getOrCreateVideoSession(userId);

    return res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la session vidéo."
    });
  }
}

async function updateProgress(req, res) {
  try {
    const userId = req.user.id;
    const { watchedSeconds } = req.body;

    const session = await videoService.updateProgress(
      userId,
      watchedSeconds
    );

    return res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour de la progression."
    });
  }
}

async function resetSession(req, res) {
  try {
    const userId = req.user.id;

    const session = await videoService.resetSession(userId);

    return res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la réinitialisation."
    });
  }
}

module.exports = {
  getVideoSession,
  updateProgress,
  resetSession
};