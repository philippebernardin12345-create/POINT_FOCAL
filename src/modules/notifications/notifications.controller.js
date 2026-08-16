
/**
 * POINT FOCAL V10.4 - Contrôleur Notifications
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 31, 32
 */

const notificationsService = require("./notifications.service");
const { success, error, notFound, validationError } = require("../../utils/response");
const { logger } = require("../../utils/logger");

/**
 * Récupère les notifications de l'utilisateur
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const read = req.query.read === 'true' ? true : 
                 req.query.read === 'false' ? false : undefined;

    const result = await notificationsService.getNotifications(userId, page, limit, read);

    return success(res, result.notifications, "Notifications récupérées avec succès", {
      page,
      limit,
      total: result.total,
      pages: Math.ceil(result.total / limit)
    });
  } catch (error) {
    logger.error("[Notifications] Erreur getNotifications:", error);
    return error(res, error.message || "Erreur lors de la récupération des notifications");
  }
}

/**
 * Récupère le nombre de notifications non lues
 */
async function getUnreadCount(req, res) {
  try {
    const userId = req.user.id;

    const count = await notificationsService.getUnreadCount(userId);

    return success(res, { count }, "Nombre de notifications non lues récupéré");
  } catch (error) {
    logger.error("[Notifications] Erreur getUnreadCount:", error);
    return error(res, error.message || "Erreur lors du comptage des notifications");
  }
}

/**
 * Marque une notification comme lue
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await notificationsService.markAsRead(notificationId, userId);

    if (!notification) {
      return notFound(res, "Notification introuvable");
    }

    return success(res, notification, "Notification marquée comme lue");
  } catch (error) {
    logger.error("[Notifications] Erreur markAsRead:", error);
    return error(res, error.message || "Erreur lors du marquage de la notification");
  }
}

/**
 * Marque toutes les notifications comme lues
 */
async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;

    const count = await notificationsService.markAllAsRead(userId);

    return success(res, { count }, `${count} notification(s) marquée(s) comme lues`);
  } catch (error) {
    logger.error("[Notifications] Erreur markAllAsRead:", error);
    return error(res, error.message || "Erreur lors du marquage des notifications");
  }
}

/**
 * Envoie une notification de test (admin uniquement)
 */
async function sendTestNotification(req, res) {
  try {
    const { title, message, userId } = req.body;

    if (!title || !message) {
      return validationError(res, "Titre et message obligatoires");
    }

    const result = await notificationsService.sendTestNotification({
      title,
      message,
      userId,
      senderId: req.user.id
    });

    return success(res, result, "Notification de test envoyée avec succès");
  } catch (error) {
    logger.error("[Notifications] Erreur sendTestNotification:", error);
    return error(res, error.message || "Erreur lors de l'envoi de la notification de test");
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  sendTestNotification
};