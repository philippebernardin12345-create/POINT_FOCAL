/**
 * POINT FOCAL V10.4 - Routes Administration
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 33, 34
 */

const express = require("express");
const router = express.Router();

const { authenticate, requireAdmin } = require("../../middlewares/auth.middleware");
const adminController = require("./admin.controller");

/**
 * POST /api/admin/login
 * Connexion administrateur
 * 
 * Body:
 * - email: string
 * - password: string
 */
router.post("/login", adminController.login);

/**
 * GET /api/admin/dashboard
 * Statistiques du dashboard admin
 */
router.get("/dashboard", authenticate, requireAdmin, adminController.getDashboardStats);

/**
 * GET /api/admin/users
 * Liste des utilisateurs
 * 
 * Query:
 * - page: number (défaut: 1)
 * - limit: number (défaut: 20)
 * - search: string (optionnel)
 */
router.get("/users", authenticate, requireAdmin, adminController.getUsers);

/**
 * GET /api/admin/users/:userId
 * Détails d'un utilisateur
 */
router.get("/users/:userId", authenticate, requireAdmin, adminController.getUserDetails);

/**
 * PUT /api/admin/users/:userId/status
 * Met à jour le statut d'un utilisateur
 * 
 * Body:
 * - status: string (active, blocked, suspended, pending)
 */
router.put("/users/:userId/status", authenticate, requireAdmin, adminController.updateUserStatus);

/**
 * GET /api/admin/opportunities
 * Liste des opportunités
 */
router.get("/opportunities", authenticate, requireAdmin, adminController.getOpportunities);

/**
 * POST /api/admin/opportunities
 * Crée une nouvelle opportunité
 * 
 * Body:
 * - name: string
 * - slug: string
 * - description: string (optionnel)
 * - status: string (active, inactive, draft)
 * - isAvailable: boolean
 * - priority: number
 * - isEntry: boolean
 * - canGeneratePointFocalLink: boolean
 * - requiresProvision: boolean
 * - provisionAmount: number (optionnel)
 * - provisionMessage: string (optionnel)
 * - registrationUrl: string (optionnel)
 * - dependsOn: string (optionnel)
 */
router.post("/opportunities", authenticate, requireAdmin, adminController.createOpportunity);

/**
 * PUT /api/admin/opportunities/:opportunityId
 * Met à jour une opportunité
 */
router.put("/opportunities/:opportunityId", authenticate, requireAdmin, adminController.updateOpportunity);

/**
 * DELETE /api/admin/opportunities/:opportunityId
 * Supprime une opportunité
 */
router.delete("/opportunities/:opportunityId", authenticate, requireAdmin, adminController.deleteOpportunity);

/**
 * GET /api/admin/leaders
 * Liste des leaders
 */
router.get("/leaders", authenticate, requireAdmin, adminController.getLeaders);

/**
 * GET /api/admin/leaders/count
 * Compte les leaders
 */
router.get("/leaders/count", authenticate, requireAdmin, adminController.countLeaders);

/**
 * GET /api/admin/payments
 * Liste des paiements
 */
router.get("/payments", authenticate, requireAdmin, adminController.getPayments);

/**
 * POST /api/admin/announcements
 * Envoie une annonce à tous les utilisateurs
 * 
 * Body:
 * - title: string
 * - message: string
 * - language: string (optionnel)
 */
router.post("/announcements", authenticate, requireAdmin, adminController.sendAnnouncement);

/**
 * POST /api/admin/emergency/stop
 * Arrêt d'urgence - Suspend les opérations critiques
 * 
 * Body:
 * - reason: string
 * - duration: number (minutes, optionnel)
 */
router.post("/emergency/stop", authenticate, requireAdmin, adminController.emergencyStop);

/**
 * POST /api/admin/emergency/resume
 * Reprise après arrêt d'urgence
 */
router.post("/emergency/resume", authenticate, requireAdmin, adminController.emergencyResume);

/**
 * GET /api/admin/emergency/status
 * Statut de l'arrêt d'urgence
 */
router.get("/emergency/status", authenticate, requireAdmin, adminController.emergencyStatus);

module.exports = router;