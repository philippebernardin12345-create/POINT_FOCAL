// src/routes/index.js
const express = require("express");

// Modules existants
const videoRoutes = require("../modules/video/video.routes");
const paymentsRoutes = require("../modules/payments/payments.routes");
const opportunitiesRoutes = require("../modules/opportunities/opportunities.routes");
const userOpportunitiesRoutes = require("../modules/users/user-opportunities/user-opportunities.routes");

// NOUVEAUX MODULES V10.4
const authRoutes = require("../modules/auth/auth.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const followmeRoutes = require("../modules/followme/followme.routes");

const router = express.Router();

// ─── Statut API ──────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API Point Focal V10.4",
    version: "10.4.0"
  });
});

// ─── Authentification ────────────────────────────────────────────────────────
router.use("/auth", authRoutes);

// ─── Administration ──────────────────────────────────────────────────────────
// router.use("/admin", adminRoutes); // À activer quand admin sera créé

// ─── Vidéos ──────────────────────────────────────────────────────────────────
router.use("/video", videoRoutes);

// ─── Paiements ───────────────────────────────────────────────────────────────
router.use("/payment", paymentsRoutes);

// ─── Opportunités (moteur générique V10.4) ──────────────────────────────────
router.use("/opportunities", opportunitiesRoutes);

// ─── Liens utilisateurs par opportunité (Follow Me) ────────────────────────
router.use("/user-opportunities", userOpportunitiesRoutes);

// ─── Follow Me ──────────────────────────────────────────────────────────────
// router.use("/followme", followmeRoutes); // À activer quand followme sera créé

module.exports = router;