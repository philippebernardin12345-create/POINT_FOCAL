const express = require("express");
const authController = require("./auth.controllers");
const authMiddleware = require("../../middlewares/auth.middleware");

const router = express.Router();

// Inscription
router.post("/register", authController.register);

// Connexion
router.post("/login", authController.login);

// Confirmation par code OTP
router.post("/confirm-otp", authController.confirmOtp);

// Ancienne confirmation par lien
router.get("/confirm-email/:userId", authController.confirmEmail);

// Demande de réinitialisation du mot de passe
router.post("/forgot-password", authController.forgotPassword);

// Enregistrement du nouveau mot de passe
router.post("/reset-password", authController.resetPassword);

// Utilisateur connecté
router.get("/me", authMiddleware, authController.me);

module.exports = router;