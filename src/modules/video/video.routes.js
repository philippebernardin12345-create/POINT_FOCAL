const express = require("express");
const router = express.Router();

const videoController = require("./video.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.get("/session", authMiddleware, videoController.getVideoSession);

router.post("/progress", authMiddleware, videoController.updateProgress);

router.post("/reset", authMiddleware, videoController.resetSession);

module.exports = router;