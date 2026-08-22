/**
 * POINT FOCAL V10.4 - Contrôleur Administration
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 33, 34
 */

const adminService = require("./admin.service");
const { success, error, unauthorized, forbidden, notFound, validationError } = require("../../utils/response");
const { logger } = require("../../utils/logger");

/**
 * Connexion administrateur
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return validationError(res, "Email et mot de passe obligatoires");
    }

    const result = await adminService.login(email, password);

    return success(res, result, "Connexion administrateur réussie");

  } catch (error) {
    logger.error("[Admin] Erreur login:", error);
    return error(res, error.message || "Erreur de connexion");
  }
}

/**
 * Statistiques du dashboard admin
 */
async function getDashboardStats(req, res) {
  try {
    const stats = await adminService.getDashboardStats();

    return success(res, stats, "Statistiques récupérées avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur getDashboardStats:", error);
    return error(res, error.message || "Erreur lors de la récupération des statistiques");
  }
}

/**
 * Liste des utilisateurs
 */
async function getUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";

    const result = await adminService.getUsers(page, limit, search);

    return success(res, result.users, "Utilisateurs récupérés avec succès", {
      page,
      limit,
      total: result.total,
      pages: Math.ceil(result.total / limit)
    });

  } catch (error) {
    logger.error("[Admin] Erreur getUsers:", error);
    return error(res, error.message || "Erreur lors de la récupération des utilisateurs");
  }
}

/**
 * Détails d'un utilisateur
 */
async function getUserDetails(req, res) {
  try {
    const { userId } = req.params;

    const user = await adminService.getUserDetails(userId);

    if (!user) {
      return notFound(res, "Utilisateur introuvable");
    }

    return success(res, user, "Utilisateur récupéré avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur getUserDetails:", error);
    return error(res, error.message || "Erreur lors de la récupération de l'utilisateur");
  }
}

/**
 * Met à jour le statut d'un utilisateur
 */
async function updateUserStatus(req, res) {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!status) {
      return validationError(res, "Le statut est obligatoire");
    }

    const validStatuses = ["active", "blocked", "suspended", "pending"];

    if (!validStatuses.includes(status)) {
      return validationError(res, `Statut invalide. Valeurs acceptées: ${validStatuses.join(", ")}`);
    }

    const user = await adminService.updateUserStatus(userId, status);

    if (!user) {
      return notFound(res, "Utilisateur introuvable");
    }

    return success(res, user, "Statut mis à jour avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur updateUserStatus:", error);
    return error(res, error.message || "Erreur lors de la mise à jour du statut");
  }
}

/**
 * Liste des opportunités
 */
async function getOpportunities(req, res) {
  try {
    const opportunities = await adminService.getOpportunities();

    return success(res, opportunities, "Opportunités récupérées avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur getOpportunities:", error);
    return error(res, error.message || "Erreur lors de la récupération des opportunités");
  }
}

/**
 * Crée une nouvelle opportunité
 */
async function createOpportunity(req, res) {
  try {
    const data = req.body;

    // Validation des champs obligatoires
    if (!data.name) {
      return validationError(res, "Le nom de l'opportunité est obligatoire");
    }

    if (!data.slug) {
      return validationError(res, "Le slug de l'opportunité est obligatoire");
    }

    const opportunity = await adminService.createOpportunity(data);

    return success(res, opportunity, "Opportunité créée avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur createOpportunity:", error);
    return error(res, error.message || "Erreur lors de la création de l'opportunité");
  }
}

/**
 * Met à jour une opportunité
 */
async function updateOpportunity(req, res) {
  try {
    const { opportunityId } = req.params;
    const data = req.body;

    const opportunity = await adminService.updateOpportunity(opportunityId, data);

    if (!opportunity) {
      return notFound(res, "Opportunité introuvable");
    }

    return success(res, opportunity, "Opportunité mise à jour avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur updateOpportunity:", error);
    return error(res, error.message || "Erreur lors de la mise à jour de l'opportunité");
  }
}

/**
 * Supprime une opportunité
 */
async function deleteOpportunity(req, res) {
  try {
    const { opportunityId } = req.params;

    const result = await adminService.deleteOpportunity(opportunityId);

    if (!result) {
      return notFound(res, "Opportunité introuvable");
    }

    return success(res, null, "Opportunité supprimée avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur deleteOpportunity:", error);
    return error(res, error.message || "Erreur lors de la suppression de l'opportunité");
  }
}

/**
 * Liste des leaders
 */
async function getLeaders(req, res) {
  try {
    const leaders = await adminService.getLeaders();

    return success(res, leaders, "Leaders récupérés avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur getLeaders:", error);
    return error(res, error.message || "Erreur lors de la récupération des leaders");
  }
}

/**
 * Compte les leaders
 */
async function countLeaders(req, res) {
  try {
    const count = await adminService.countLeaders();

    return success(res, { count }, "Nombre de leaders récupéré avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur countLeaders:", error);
    return error(res, error.message || "Erreur lors du comptage des leaders");
  }
}

/**
 * Liste des paiements
 */
async function getPayments(req, res) {
  try {
    const payments = await adminService.getPayments();

    return success(res, payments, "Paiements récupérés avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur getPayments:", error);
    return error(res, error.message || "Erreur lors de la récupération des paiements");
  }
}

/**
 * Envoie une annonce à tous les utilisateurs
 */
async function sendAnnouncement(req, res) {
  try {
    const { title, message, language } = req.body;

    if (!title || !message) {
      return validationError(res, "Titre et message obligatoires");
    }

    const result = await adminService.sendAnnouncement(title, message, language);

    return success(res, result, "Annonce envoyée avec succès");

  } catch (error) {
    logger.error("[Admin] Erreur sendAnnouncement:", error);
    return error(res, error.message || "Erreur lors de l'envoi de l'annonce");
  }
}

/**
 * Arrêt d'urgence
 */
async function emergencyStop(req, res) {
  try {
    const { reason, duration } = req.body;
    const userId = req.user.id;

    if (!reason) {
      return validationError(res, "Une raison est obligatoire");
    }

    const result = await adminService.emergencyStop(userId, reason, duration);

    return success(res, result, "Arrêt d'urgence activé");

  } catch (error) {
    logger.error("[Admin] Erreur emergencyStop:", error);
    return error(res, error.message || "Erreur lors de l'activation de l'arrêt d'urgence");
  }
}

/**
 * Reprise après arrêt d'urgence
 */
async function emergencyResume(req, res) {
  try {
    const userId = req.user.id;

    const result = await adminService.emergencyResume(userId);

    return success(res, result, "Reprise après arrêt d'urgence effectuée");

  } catch (error) {
    logger.error("[Admin] Erreur emergencyResume:", error);
    return error(res, error.message || "Erreur lors de la reprise après arrêt d'urgence");
  }
}

/**
 * Statut de l'arrêt d'urgence
 */
async function emergencyStatus(req, res) {
  try {
    const status = await adminService.emergencyStatus();

    return success(res, status, "Statut de l'arrêt d'urgence récupéré");

  } catch (error) {
    logger.error("[Admin] Erreur emergencyStatus:", error);
    return error(res, error.message || "Erreur lors de la récupération du statut");
  }
}

module.exports = {
  login,
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserStatus,
  getOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getLeaders,
  countLeaders,
  getPayments,
  sendAnnouncement,
  emergencyStop,
  emergencyResume,
  emergencyStatus
};