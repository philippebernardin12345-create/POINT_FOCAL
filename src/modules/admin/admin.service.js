const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const repository =
  require("./admin.repository");


// ============================================================
// CONNEXION ADMINISTRATEUR
// ============================================================

async function login(payload) {
  const email = String(
    payload?.email || ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    payload?.password || ""
  );

  if (!email || !password) {
    throw new Error(
      "Email et mot de passe obligatoires."
    );
  }

  const adminEmail = String(
    process.env.ADMIN_EMAIL || ""
  )
    .trim()
    .toLowerCase();

  const adminPasswordHash = String(
    process.env.ADMIN_PASSWORD_HASH || ""
  ).trim();

  if (
    !adminEmail ||
    !adminPasswordHash
  ) {
    throw new Error(
      "Le compte administrateur n’est pas encore configuré."
    );
  }

  if (email !== adminEmail) {
    throw new Error(
      "Identifiants administrateur incorrects."
    );
  }

  const passwordIsValid =
    await bcrypt.compare(
      password,
      adminPasswordHash
    );

  if (!passwordIsValid) {
    throw new Error(
      "Identifiants administrateur incorrects."
    );
  }

  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      "La clé JWT_SECRET est absente."
    );
  }

  const admin = {
    email: adminEmail,
    role: "super_admin",
    isAdmin: true
  };

  const token = jwt.sign(
    {
      email: admin.email,
      role: admin.role,
      isAdmin: true
    },
    jwtSecret,
    {
      expiresIn: "12h"
    }
  );

  return {
    message:
      "Connexion administrateur réussie.",

    token,

    user: admin
  };
}


// ============================================================
// STATISTIQUES DU DASHBOARD
// ============================================================

async function dashboard() {
  return repository.getDashboardStats();
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  login,
  dashboard
};