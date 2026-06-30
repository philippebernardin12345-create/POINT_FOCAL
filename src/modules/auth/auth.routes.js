const express = require("express");
const authController = require("./auth.controllers");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/confirm-email/:userId", authController.confirmEmail);

module.exports = router;