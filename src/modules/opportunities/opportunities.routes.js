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

// Enregistrement d’un lien Follow Me
router.post(
  "/follow-me/register",
  authMiddleware,
  opportunityController.registerFollowMeLink
);

module.exports = router;
