
const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const paymentsController = require("./payments.controller");

const router = express.Router();

router.post("/auto-trigger", authMiddleware, paymentsController.autoTrigger);

module.exports = router;