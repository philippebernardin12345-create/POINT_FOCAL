const { verifyToken } = require("../config/jwt");

function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token manquant."
      });
    }

    const token = header.split(" ")[1];
    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token invalide ou expiré."
    });
  }
}

module.exports = authMiddleware;