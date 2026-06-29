function errorMiddleware(err, req, res, next) {
  console.error("Erreur globale :", err);

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Erreur serveur."
  });
}

module.exports = errorMiddleware;