const { verifyToken } = require("../config/jwt");
const { findRootUser } = require("../modules/auth/auth.repository");
const { isVerifiedSuperAdmin } = require("../utils/admin-token");

async function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ success: false, message: "Connexion administrateur requise." });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    return res.status(401).json({ success: false, message: "Session administrateur invalide ou expirée." });
  }

  if (!isVerifiedSuperAdmin(decoded, process.env.ADMIN_EMAIL)) {
    return res.status(403).json({ success: false, message: "Accès administrateur refusé." });
  }

  try {
    const rootUser = await findRootUser();
    if (!rootUser || rootUser.is_root !== true) {
      return res.status(503).json({ success: false, message: "Compte racine introuvable." });
    }

    req.user = { ...rootUser, isAdmin: true, role: "super_admin" };
    req.admin = { email: decoded.email, role: decoded.role };
    return next();
  } catch (error) {
    console.error("[Admin Auth] Root account lookup failed:", error);
    return res.status(503).json({ success: false, message: "Vérification administrateur indisponible." });
  }
}

module.exports = { authenticateAdmin };
