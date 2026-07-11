const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const victoryController = require("./victory.controller");

const router = express.Router();

router.post(
  "/assign",
  authMiddleware,
  victoryController.assignVictoryLink
);

router.post(
  "/reactivate",
  authMiddleware,
  victoryController.reactivateVictory
);

module.exports = router;