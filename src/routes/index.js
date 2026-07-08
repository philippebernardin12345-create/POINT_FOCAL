const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const videoRoutes = require("../modules/video/video.routes");
const victoryRoutes = require("../modules/victory/victory.routes");
const paymentsRoutes = require("../modules/payments/payments.routes");
const opportunityRoutes = require("../modules/opportunities/opportunity.routes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API Point Focal V9"
  });
});

router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/victory-link", victoryRoutes);
router.use("/payment", paymentsRoutes);
router.use("/opportunities", opportunityRoutes);

module.exports = router;