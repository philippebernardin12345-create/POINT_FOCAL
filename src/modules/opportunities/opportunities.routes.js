const express = require("express");
const router = express.Router();

const opportunityController = require("./opportunity.controller");

// Liste complète des opportunités
router.get("/", opportunityController.getAll);

// Opportunités actives seulement
router.get("/active", opportunityController.getActive);

// Prochaine opportunité après une position donnée
router.get("/next/:position", opportunityController.getNext);

module.exports = router;