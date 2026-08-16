
/**
 * POINT FOCAL V10.4 - Routes Notifications
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 31, 32
 */

const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const notificationsController = require("./notifications.controller");

/**
 * GET /api/notifications
 * Récupère les notifications de l'utilisateur
 * 
 * Query:
 * - page: number (défaut: 1)
 * - limit: number (défaut: 20)
 * - read: boolean (filtrer par lu/non lu)
 */
router.get("/", authenticate, notificationsController.getNotifications);

/**
 * GET /api/notifications/unread/count
 * Récupère le nombre de notifications non lues
 */
router.get("/unread/count", authenticate, notificationsController.getUnreadCount);

/**
 * PUT /api/notifications/:notificationId/read
 * Marque une notification comme lue
 */
router.put("/:notificationId/read", authenticate, notificationsController.markAsRead);

/**
 * PUT /api/notifications/read-all
 * Marque toutes les notifications comme lues
 */
router.put("/read-all", authenticate, notificationsController.markAllAsRead);

/**
 * POST /api/notifications/test
 * Envoie une notification de test (admin uniquement)
 * 
 * Body:
 * - title: string
 * - message: string
 * - userId: string (optionnel)
 */
router.post("/test", authenticate, notificationsController.sendTestNotification);

module.exports = router;