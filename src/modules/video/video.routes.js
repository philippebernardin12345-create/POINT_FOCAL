const express = require("express");
const router = express.Router();

const videoController = require("./video.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.get("/session", authenticate, videoController.getVideoSession);

router.post("/progress", authenticate, videoController.updateProgress);

router.post("/reset", authenticate, videoController.resetSession);

module.exports = router;
