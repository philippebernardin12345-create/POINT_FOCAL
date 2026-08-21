function success(res, data = {}, message = "Succès", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function error(res, message = "Erreur serveur", statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

function unauthorized(res, message = "Non autorisé") {
  return error(res, message, 401);
}

function forbidden(res, message = "Accès interdit") {
  return error(res, message, 403);
}

function notFound(res, message = "Ressource introuvable") {
  return error(res, message, 404);
}

function validationError(res, message = "Données invalides") {
  return error(res, message, 400);
}

module.exports = {
  success,
  error,
  unauthorized,
  forbidden,
  notFound,
  validationError
};
