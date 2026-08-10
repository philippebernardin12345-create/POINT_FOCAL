const express = require("express");
const router = express.Router();

const opportunityController = require(
  "./opportunities.controller"
);

const authMiddleware = require(
  "../../middlewares/auth.middleware"
);

// Liste complète des opportunités
router.get(
  "/",
  opportunityController.getAll
);

// Opportunités actives seulement
router.get(
  "/active",
  opportunityController.getActive
);

// Opportunité d'entrée Follow Me
router.get(
  "/entry",
  opportunityController.getEntry
);

// Prochaine opportunité après une position donnée
router.get(
  "/next/:position",
  opportunityController.getNext
);

// Opportunités éligibles pour l'utilisateur connecté (moteur générique)
router.get(
  "/eligible",
  authMiddleware,
  opportunityController.getEligible
);

// Enregistrement d’un lien Follow Me
router.post(
  "/follow-me/register",
  authMiddleware,
  opportunityController.registerFollowMeLink
);

// Route paramétrée : récupérer une opportunité par son slug
// Doit être placée *après* toutes les routes statiques pour éviter les collisions
router.get('/:slug', opportunityController.getBySlug);

module.exports = router;