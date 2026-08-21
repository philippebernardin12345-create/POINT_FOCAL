const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const paymentsController = require("./payments.controller");

const router = express.Router();

router.post("/auto-trigger", authenticate, paymentsController.autoTrigger);

module.exports = router;
