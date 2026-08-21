
 
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
 * GET /api/followme/sponsor/:opportunitySlug
 * Récupère le lien sponsor disponible pour une opportunité
 */
router.get("/sponsor/:opportunitySlug", authenticate, followmeController.getSponsorLink);

module.exports = router;
 