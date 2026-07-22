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

// Prochaine opportunité après une position donnée
router.get(
  "/next/:position",
  opportunityController.getNext
);

// Enregistrement d’un lien dans Follow Me
router.post(
  "/follow-me/register",
  authMiddleware,
  opportunityController.registerFollowMeLink
);

module.exports = router;