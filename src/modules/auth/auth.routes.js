const express = require("express");
const authController = require("./auth.controllers");
const authMiddleware = require("../../middlewares/auth.middleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/confirm-email/:userId", authController.confirmEmail);
router.get("/me", authMiddleware, authController.me);

module.exports = router;