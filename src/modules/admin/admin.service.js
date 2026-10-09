const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const repository = require("./admin.repository");
const opportunitiesRepository = require("../opportunities/opportunities.repository");
const opportunitiesRegistry = require("../opportunities/opportunities.registry");


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

async function getDashboardStats() {
  return dashboard();
}

async function getUsers(page = 1, limit = 20, search = "") {
  const allUsers = await repository.getUsers();
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const filtered = normalizedSearch
    ? allUsers.filter((user) =>
        [user.email, user.whatsapp, user.id]
          .some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
      )
    : allUsers;
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const start = (safePage - 1) * safeLimit;
  return { users: filtered.slice(start, start + safeLimit), total: filtered.length };
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
// RÉCUPÉRER LES OPPORTUNITÉS
// ============================================================

async function getOpportunities() {
  return opportunitiesRepository.findAll();
}

// ============================================================
// AJOUTER UNE OPPORTUNITÉ
// ============================================================

async function createOpportunity(payload) {
  const name = String(payload?.name || "").trim();
  const slug = String(payload?.slug || "").trim().toLowerCase();
  const status = String(payload?.status || "DRAFT").trim().toUpperCase();
  const position = Number(payload?.position);
  const priority = Number(payload?.priority);

  if (!name) throw new Error("Le nom de l’opportunité est obligatoire.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Le slug doit contenir des lettres minuscules, chiffres et tirets.");
  }
  if (!["ACTIVE", "INACTIVE", "DRAFT"].includes(status)) {
    throw new Error("Le statut de l’opportunité est invalide.");
  }
  if (!Number.isInteger(position) || position < 1) {
    throw new Error("La position doit être un entier supérieur ou égal à 1.");
  }
  if (!Number.isInteger(priority) || priority < 1) {
    throw new Error("La priorité doit être un entier supérieur ou égal à 1.");
  }

  const opportunity = await opportunitiesRepository.create({
    name,
    slug,
    status,
    position,
    priority,
    isEntry: payload?.isEntry === true,
    canGeneratePointFocalLink: payload?.canGeneratePointFocalLink === true,
    requiresUserLink: payload?.requiresUserLink === true,
    rollupEnabled: payload?.rollupEnabled === true
  });
  await opportunitiesRegistry.loadFromDatabase(opportunitiesRepository);
  return opportunity;
}
// ============================================================
// MODIFIER UNE OPPORTUNITÉ
// ============================================================

async function updateOpportunity(opportunityId, payload) {
  const id = String(opportunityId || "").trim();
  if (!id) throw new Error("Identifiant de l’opportunité invalide.");

  const updates = {};
  for (const field of ["name", "slug"]) {
    if (payload?.[field] !== undefined) updates[field] = String(payload[field]).trim();
  }
  if (payload?.status !== undefined) {
    const status = String(payload.status).trim().toUpperCase();
    if (!["ACTIVE", "INACTIVE", "DRAFT"].includes(status)) {
      throw new Error("Le statut de l’opportunité est invalide.");
    }
    updates.status = status;
  }
  for (const field of ["position", "priority"]) {
    if (payload?.[field] !== undefined) {
      const value = Number(payload[field]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Le champ ${field} doit être un entier supérieur ou égal à 1.`);
      }
      updates[field] = value;
    }
  }
  for (const [field, type] of [
    ["isEntry", "isEntry"],
    ["canGeneratePointFocalLink", "canGeneratePointFocalLink"],
    ["requiresUserLink", "requiresUserLink"],
    ["rollupEnabled", "rollupEnabled"]
  ]) {
    if (payload?.[field] !== undefined) {
      if (typeof payload[field] !== "boolean") {
        throw new Error(`Le champ ${field} doit être booléen.`);
      }
      updates[type] = payload[field];
    }
  }
  if (updates.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(updates.slug)) {
    throw new Error("Le slug doit contenir des lettres minuscules, chiffres et tirets.");
  }
  if (updates.name === "") throw new Error("Le nom de l’opportunité est obligatoire.");
  if (Object.keys(updates).length === 0) throw new Error("Aucune donnée à mettre à jour.");

  const opportunity = await opportunitiesRepository.update(id, updates);
  if (opportunity) await opportunitiesRegistry.loadFromDatabase(opportunitiesRepository);
  return opportunity;
}

module.exports = {
  login,
  dashboard,
  getDashboardStats,
  users,
  getUsers,
  settings,
  getOpportunities,
  createOpportunity,
  updateOpportunity
};