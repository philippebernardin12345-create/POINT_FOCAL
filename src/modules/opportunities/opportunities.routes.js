/**
 * POINT FOCAL V10.4 - Routes Opportunités
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 4, 5, 6
 */

const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const opportunitiesController = require("./opportunities.controller");

/**
 * GET /api/opportunities
 * Liste toutes les opportunités disponibles
 */
router.get("/", opportunitiesController.getAll);

/**
 * GET /api/opportunities/active
 * Liste les opportunités actives
 */
router.get("/active", opportunitiesController.getActive);

/**
 * GET /api/opportunities/entry
 * Récupère l'opportunité d'entrée dynamique
 */
router.get("/entry", authenticate, opportunitiesController.getEntry);

/**
 * GET /api/opportunities/generator
 * Récupère le générateur du lien PF dynamique
 */
router.get("/generator", authenticate, opportunitiesController.getGenerator);

/**
 * GET /api/opportunities/next
 * Récupère la prochaine opportunité pour un utilisateur
 * 
 * Query:
 * - currentOpportunityId: string (ID de l'opportunité actuelle)
 */
router.get("/next", authenticate, opportunitiesController.getNext);

/**
 * GET /api/opportunities/:slug
 * Récupère une opportunité par son slug
 */
router.get("/:slug", opportunitiesController.getBySlug);

/**
 * POST /api/opportunities/followme
 * Enregistre le lien Follow Me pour une opportunité
 * 
 * Body:
 * - opportunityId: string
 * - referralLink: string
 * - targetAddress: string (optionnel)
 * - paymentHash: string (optionnel)
 */
router.post("/followme", authenticate, opportunitiesController.registerFollowMeLink);

module.exports = router;