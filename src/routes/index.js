/**
 * POINT FOCAL V10.4 - Routes API
 * 
 * Point d'entrée de toutes les routes de l'API
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 35
 */

const express = require("express");

// Modules existants
const videoRoutes = require("../modules/video/video.routes");
const paymentsRoutes = require("../modules/payments/payments.routes");
const opportunitiesRoutes = require("../modules/opportunities/opportunities.routes");
const userOpportunitiesRoutes = require("../modules/user-opportunities/user-opportunities.routes");

// NOUVEAUX MODULES V10.4
const authRoutes = require("../modules/auth/auth.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const followmeRoutes = require("../modules/followme/followme.routes");
const notificationsRoutes = require("../modules/notifications/notifications.routes");

const router = express.Router();

// ─── Statut API ──────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API Point Focal V10.4",
    version: "10.4.0",
    modules: {
      auth: true,
      admin: true,
      video: true,
      payments: true,
      opportunities: true,
      userOpportunities: true,
      followme: true,
      notifications: true
    }
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

// ─── Opportunités (moteur générique V10.4) ──────────────────────────────────
router.use("/opportunities", opportunitiesRoutes);

// ─── Liens utilisateurs par opportunité (Follow Me) ────────────────────────
router.use("/user-opportunities", userOpportunitiesRoutes);

// ─── Follow Me ──────────────────────────────────────────────────────────────
router.use("/followme", followmeRoutes);

// ─── Notifications ──────────────────────────────────────────────────────────
router.use("/notifications", notificationsRoutes);

module.exports = router;