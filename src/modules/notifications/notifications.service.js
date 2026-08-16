
/**
 * POINT FOCAL V10.4 - Service Notifications
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 31, 32
 */

const notificationsRepository = require("./notifications.repository");
const { findUserById } = require("../users/users.repository");
const { logger } = require("../../utils/logger");
const { isValidLanguage } = require("../../utils/validators");

/**
 * Récupère les notifications d'un utilisateur
 */
async function getNotifications(userId, page = 1, limit = 20, read = undefined) {
  return await notificationsRepository.findByUserId(userId, page, limit, read);
}

/**
 * Récupère le nombre de notifications non lues
 */
async function getUnreadCount(userId) {
  return await notificationsRepository.countUnread(userId);
}

/**
 * Marque une notification comme lue
 */
async function markAsRead(notificationId, userId) {
  // Vérifier que la notification appartient à l'utilisateur
  const notification = await notificationsRepository.findById(notificationId);

  if (!notification) {
    return null;
  }

  if (notification.user_id !== userId) {
    throw new Error("Accès non autorisé à cette notification");
  }

  return await notificationsRepository.markAsRead(notificationId);
}

/**
 * Marque toutes les notifications comme lues
 */
async function markAllAsRead(userId) {
  return await notificationsRepository.markAllAsRead(userId);
}

/**
 * Crée une notification pour un utilisateur
 */
async function createNotification({
  userId,
  type,
  title,
  message,
  language = 'fr',
  data = null
}) {
  try {
    // Valider la langue
    if (!isValidLanguage(language)) {
      language = 'fr';
    }

    // Vérifier que l'utilisateur existe
    const user = await findUserById(userId);

    if (!user) {
      logger.warn(`[Notifications] Utilisateur ${userId} introuvable`);
      return null;
    }

    // Utiliser la langue de l'utilisateur si non spécifiée
    const userLanguage = user.language || 'fr';

    return await notificationsRepository.create({
      userId,
      type,
      title,
      message,
      language: language || userLanguage,
      data
    });
  } catch (error) {
    logger.error("[Notifications] Erreur createNotification:", error);
    return null;
  }
}

/**
 * Envoie une notification à plusieurs utilisateurs
 */
async function sendBulkNotification({
  userIds,
  type,
  title,
  message,
  language = 'fr'
}) {
  const results = [];

  for (const userId of userIds) {
    const result = await createNotification({
      userId,
      type,
      title,
      message,
      language
    });

    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Envoie une notification à tous les utilisateurs
 */
async function sendGlobalNotification({
  type,
  title,
  message,
  language = null,
  excludeUserIds = []
}) {
  // Récupérer tous les utilisateurs actifs
  const users = await notificationsRepository.findAllActiveUsers();

  const results = [];

  for (const user of users) {
    if (excludeUserIds.includes(user.id)) {
      continue;
    }

    const result = await createNotification({
      userId: user.id,
      type,
      title,
      message,
      language: language || user.language || 'fr'
    });

    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Envoie une notification de test
 */
async function sendTestNotification({ title, message, userId, senderId }) {
  const targetUserId = userId || senderId;

  return await createNotification({
    userId: targetUserId,
    type: 'test',
    title: `[TEST] ${title}`,
    message: `${message}\n\nEnvoyé depuis le dashboard admin.`,
    language: 'fr'
  });
}

/**
 * Notification d'inscription
 */
async function notifyRegistration(userId) {
  return await createNotification({
    userId,
    type: 'registration',
    title: 'Bienvenue sur Point Focal',
    message: 'Votre compte a été créé avec succès. Veuillez confirmer votre email avec le code OTP reçu.',
    language: 'fr'
  });
}

/**
 * Notification OTP
 */
async function notifyOtp(userId, otp) {
  return await createNotification({
    userId,
    type: 'otp',
    title: 'Code de confirmation OTP',
    message: `Votre code de confirmation est : ${otp}. Ce code expire dans 15 minutes.`,
    language: 'fr'
  });
}

/**
 * Notification attribution sponsor
 */
async function notifySponsorAssignment(userId, sponsorId) {
  return await createNotification({
    userId,
    type: 'sponsor_assignment',
    title: 'Parrain attribué',
    message: `Un parrain vous a été attribué automatiquement.`,
    language: 'fr'
  });
}

/**
 * Notification leader inscription
 */
async function notifyLeaderRegistration(userId, position) {
  return await createNotification({
    userId,
    type: 'leader_registration',
    title: 'Position de leader enregistrée',
    message: `Vous êtes enregistré comme leader en position ${position}.`,
    language: 'fr'
  });
}

/**
 * Notification seuil 40 leaders
 */
async function notifyLeaderThreshold(userId, currentCount) {
  return await createNotification({
    userId,
    type: 'leader_threshold',
    title: 'Démarrage imminent',
    message: `${currentCount} leaders sont déjà enregistrés. Le démarrage est imminent.`,
    language: 'fr'
  });
}

/**
 * Notification activation
 */
async function notifyActivation(userId) {
  return await createNotification({
    userId,
    type: 'activation',
    title: 'Compte activé',
    message: 'Votre compte Point Focal est maintenant actif.',
    language: 'fr'
  });
}

/**
 * Notification opportunité suivante
 */
async function notifyNextOpportunity(userId, opportunityName) {
  return await createNotification({
    userId,
    type: 'next_opportunity',
    title: 'Nouvelle opportunité disponible',
    message: `L'opportunité "${opportunityName}" est maintenant disponible.`,
    language: 'fr'
  });
}

/**
 * Notification Follow Me
 */
async function notifyFollowMe(userId, opportunityName) {
  return await createNotification({
    userId,
    type: 'follow_me',
    title: 'Follow Me activé',
    message: `Vous avez été positionné dans "${opportunityName}" via Follow Me.`,
    language: 'fr'
  });
}

/**
 * Notification roll-up
 */
async function notifyRollup(userId, opportunityName) {
  return await createNotification({
    userId,
    type: 'rollup',
    title: 'Roll-up appliqué',
    message: `Un roll-up a été appliqué pour l'opportunité "${opportunityName}".`,
    language: 'fr'
  });
}

/**
 * Notification d'expiration
 */
async function notifyExpiration(userId, opportunityName, days = 1) {
  return await createNotification({
    userId,
    type: 'expiration',
    title: 'Délai de finalisation',
    message: `Vous avez ${days} jour(s) pour finaliser votre parcours dans "${opportunityName}".`,
    language: 'fr'
  });
}

/**
 * Notification d'annonce
 */
async function notifyAnnouncement(userId, title, message) {
  return await createNotification({
    userId,
    type: 'announcement',
    title,
    message,
    language: 'fr'
  });
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  sendBulkNotification,
  sendGlobalNotification,
  sendTestNotification,
  notifyRegistration,
  notifyOtp,
  notifySponsorAssignment,
  notifyLeaderRegistration,
  notifyLeaderThreshold,
  notifyActivation,
  notifyNextOpportunity,
  notifyFollowMe,
  notifyRollup,
  notifyExpiration,
  notifyAnnouncement
};