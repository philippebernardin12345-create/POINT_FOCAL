/**
 * POINT FOCAL V10.4 - Middleware de gestion d'erreurs
 * 
 * Centralise la gestion des erreurs et formate les réponses
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 35
 */

const { logger } = require("../utils/logger");

/**
 * Middleware de gestion d'erreurs principal
 * 
 * @param {Error} err - Erreur capturée
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {NextFunction} next - Fonction suivante
 */
function errorMiddleware(err, req, res, next) {
  // 1. Journaliser l'erreur
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || null
  });

  // 2. Déterminer le code de statut
  const statusCode = err.statusCode || err.status || 500;

  // 3. Construire la réponse
  const response = {
    success: false,
    message: err.message || "Une erreur interne est survenue.",
    code: err.code || "INTERNAL_ERROR"
  };

  // 4. Ajouter les détails en développement
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
    response.details = err.details || null;
  }

  // 5. Envoyer la réponse
  res.status(statusCode).json(response);
}

/**
 * Crée une erreur avec statut et code
 * 
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code HTTP
 * @param {string} code - Code d'erreur interne
 * @param {Object} details - Détails supplémentaires
 * @returns {Error} - Erreur formatée
 */
function createError(message, statusCode = 400, code = "BAD_REQUEST", details = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

/**
 * Erreur 404 - Route non trouvée
 * 
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {NextFunction} next - Fonction suivante
 */
function notFoundHandler(req, res, next) {
  const err = createError(
    `Route non trouvée : ${req.method} ${req.path}`,
    404,
    "ROUTE_NOT_FOUND"
  );
  next(err);
}

module.exports = {
  errorMiddleware,
  createError,
  notFoundHandler
};