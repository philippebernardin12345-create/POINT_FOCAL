const express = require("express");

const authRoutes = require(
  "../modules/auth/auth.routes"
);

const videoRoutes = require(
  "../modules/video/video.routes"
);

const victoryRoutes = require(
  "../modules/victory/victory.routes"
);

const victoryWorldRoutes = require(
  "../modules/victory-world/victory-world.routes"
);

const paymentsRoutes = require(
  "../modules/payments/payments.routes"
);

const followmeRoutes = require(
  "../modules/followme/followme.routes"
);

const opportunitiesRoutes = require(
  "../modules/opportunities/opportunities.routes"
);

const adminRoutes = require(
  "../modules/admin/admin.routes"
);

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API Point Focal V9"
  });
});

router.use(
  "/auth",
  authRoutes
);

router.use(
  "/admin",
  adminRoutes
);

router.use(
  "/video",
  videoRoutes
);

router.use(
  "/victory-link",
  victoryRoutes
);

router.use(
  "/victory-world",
  victoryWorldRoutes
);

router.use(
  "/payment",
  paymentsRoutes
);

router.use(
  "/followme",
  followmeRoutes
);

router.use(
  "/opportunities",
  opportunitiesRoutes
);

module.exports = router;