

const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const videoRoutes = require("../modules/video/video.routes");
const paymentsRoutes = require("../modules/payments/payments.routes");
const opportunitiesRoutes = require("../modules/opportunities/opportunities.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const userOpportunitiesRoutes = require("../modules/users/user-opportunities/user-opportunities.routes");
const followmeRoutes = require("../modules/followme/followme.routes");

const router = express.Router();

// ─── Statut API ──────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API Point Focal V10",
  });
});

// ─── Authentification ────────────────────────────────────────────────────────
router.use("/auth", authRoutes);

// ─── Administration ──────────────────────────────────────────────────────────
router.use("/admin", adminRoutes);

// ─── Vidéos ──────────────────────────────────────────────────────────────────
router.use("/video", videoRoutes);

// ─── Paiements ───────────────────────────────────────────────────────────────
router.use("/payment", paymentsRoutes);

// ─── Opportunités (moteur générique V10) ─────────────────────────────────────
router.use("/opportunities", opportunitiesRoutes);

// ─── Liens utilisateurs par opportunité ──────────────────────────────────────
router.use("/user-opportunities", userOpportunitiesRoutes);

// ─── Follow Me ───────────────────────────────────────────────────────────────
router.use("/followme", followmeRoutes);

module.exports = router;
 
