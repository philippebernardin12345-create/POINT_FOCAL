const express = require("express");

const { authenticate } = require("../../middlewares/auth.middleware");
const victoryController = require("./victory.controller");

const router = express.Router();

router.post(
  "/assign",
  authenticate,
  victoryController.assignVictoryLink
);

router.post(
  "/reactivate",
  authenticate,
  victoryController.reactivateVictory
);
router.post(
  "/personal-link",
  authenticate,
  victoryController.saveVictoryPersonalLink
);
module.exports = router;