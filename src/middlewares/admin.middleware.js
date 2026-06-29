function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isRoot) {
    return res.status(403).json({
      success: false,
      message: "Accès administrateur refusé."
    });
  }

  next();
}

module.exports = adminMiddleware;