const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const videoRoutes = require("../modules/video/video.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API Point Focal V9"
  });
});

router.use("/auth", authRoutes);
router.use("/video", videoRoutes);

module.exports = router;