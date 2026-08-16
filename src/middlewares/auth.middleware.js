/**
 * POINT FOCAL V10.4 - Middleware d'authentification
 * 
 * Vérifie la présence et la validité du token JWT
 * Injecte l'utilisateur dans req.user
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 25
 */

const { verifyToken } = require("../config/jwt");
const { findUserById } = require("../modules/users/users.repository");

/**
 * Middleware d'authentification principal
 * 
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {NextFunction} next - Fonction suivante
 */
async function authenticate(req, res, next) {
  try {
    // 1. Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token d'authentification manquant ou invalide."
      });
    }

    const token = authHeader.substring(7); // Supprime "Bearer "

    // 2. Vérifier le token
    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error("[Auth] Token invalide:", error.message);

      return res.status(401).json({
        success: false,
        message: "Token invalide ou expiré."
      });
    }

    // 3. Récupérer l'utilisateur depuis la base
    const userId = decoded.id || decoded.sub || decoded.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Token mal formé."
      });
    }

    const user = await findUserById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur introuvable."
      });
    }

    // 4. Vérifier que le compte est actif
    if (user.status === "blocked" || user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Compte bloqué ou suspendu."
      });
    }

    // 5. Injecter l'utilisateur dans la requête
    req.user = user;
    req.userId = userId;

    next();
  } catch (error) {
    console.error("[Auth] Erreur:", error);

    return res.status(500).json({
      success: false,
      message: "Erreur interne lors de l'authentification."
    });
  }
}

/**
 * Middleware optionnel - Vérifie la présence d'un token mais ne bloque pas
 * 
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {NextFunction} next - Fonction suivante
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const decoded = verifyToken(token);
        const userId = decoded.id || decoded.sub || decoded.userId;

        if (userId) {
          const user = await findUserById(userId);

          if (user && user.status !== "blocked") {
            req.user = user;
            req.userId = userId;
          }
        }
      } catch (error) {
        // Token invalide → on ignore, l'utilisateur reste non authentifié
      }
    }

    next();
  } catch (error) {
    next();
  }
}

/**
 * Middleware de vérification admin
 * 
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {NextFunction} next - Fonction suivante
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentification requise."
    });
  }

  if (!req.user.isAdmin && !req.user.is_leader) {
    return res.status(403).json({
      success: false,
      message: "Accès administrateur requis."
    });
  }

  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin
};