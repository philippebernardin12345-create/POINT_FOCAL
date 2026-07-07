const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const victoryController = require("./victory.controller");

const router = express.Router();

router.post("/assign", authMiddleware, victoryController.assignVictoryLink);

module.exports = router;