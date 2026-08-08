
 
const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const followmeController = require("./followme.controller");

const router = express.Router();

// Récupérer le lien sponsor pour une opportunité
router.get(
  "/:opportunitySlug",
  authMiddleware,
  followmeController.getSponsorLink
);

module.exports = router;
 