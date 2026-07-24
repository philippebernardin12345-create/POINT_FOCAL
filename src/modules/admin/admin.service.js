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

  const jwtSecret = String(
    process.env.JWT_SECRET || ""
  ).trim();

  if (!adminEmail) {
    throw new Error(
      "La variable ADMIN_EMAIL est absente ou vide sur Render."
    );
  }

  if (!adminPasswordHash) {
    throw new Error(
      "La variable ADMIN_PASSWORD_HASH est absente ou vide sur Render."
    );
  }

  if (!jwtSecret) {
    throw new Error(
      "La variable JWT_SECRET est absente ou vide sur Render."
    );
  }

  // Vérification de l’adresse email administrateur
  
if (email !== adminEmail) {
  throw new Error(
    "EMAIL_ADMIN_INCORRECT"
  );
}
  // Vérification du mot de passe avec bcrypt
  let passwordIsValid = false;

  try {
    passwordIsValid =
      await bcrypt.compare(
        password,
        adminPasswordHash
      );
  } catch (error) {
    console.error(
      "Erreur de vérification bcrypt :",
      error.message
    );

    throw new Error(
      "Impossible de vérifier le mot de passe administrateur."
    );
  }

  if (!passwordIsValid) {
  throw new Error(
    "MOT_DE_PASSE_ADMIN_INCORRECT"
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
      isAdmin: admin.isAdmin
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
// LISTE DES UTILISATEURS
// ============================================================

async function users() {
  return repository.getUsers();
}


// ============================================================
// PARAMÈTRES ADMINISTRATEUR
// ============================================================

async function settings() {
  return {
    adminEmail:
      String(
        process.env.ADMIN_EMAIL || ""
      )
        .trim()
        .toLowerCase(),

    sessionDuration:
      "12h",

    role:
      "super_admin"
  };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  login,
  dashboard,
  users,
  settings
};