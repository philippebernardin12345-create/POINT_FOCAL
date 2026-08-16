
 
/**
 * POINT FOCAL V10.4 - Routes Follow Me
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 6, 7, 8, 9, 10, 11
 */

const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const followmeController = require("./followme.controller");

/**
 * POST /api/followme/register
 * Enregistre le lien personnel d'un utilisateur pour une opportunité
 * 
 * Body:
 * - opportunityId: string (ID de l'opportunité)
 * - referralLink: string (Lien personnel de l'utilisateur)
 * - targetAddress: string (Optionnel - Adresse cible)
 * - paymentHash: string (Optionnel - Hash de paiement)
 */
router.post("/register", authenticate, followmeController.registerLink);

/**
 * GET /api/followme/links
 * Récupère tous les liens d'un utilisateur
 */
router.get("/links", authenticate, followmeController.getUserLinks);

/**
 * GET /api/followme/available/:opportunityId
 * Récupère le lien disponible le plus ancien pour une opportunité (FIFO)
 */
router.get("/available/:opportunityId", authenticate, followmeController.getAvailableLink);

/**
 * GET /api/followme/check/:opportunityId
 * Vérifie si un utilisateur a rejoint une opportunité
 */
router.get("/check/:opportunityId", authenticate, followmeController.checkOpportunity);

/**
 * POST /api/followme/rollup
 * Applique manuellement un roll-up pour un utilisateur sur une opportunité
 * 
 * Body:
 * - opportunityId: string (ID de l'opportunité)
 */
router.post("/rollup", authenticate, followmeController.applyRollup);

/**
 * GET /api/followme/rollup/history
 * Récupère l'historique des roll-up d'un utilisateur
 */
router.get("/rollup/history", authenticate, followmeController.getRollupHistory);

module.exports = router;
 