/**
 * POINT FOCAL V10.4 - Repository Utilisateurs
 * 
 * Accès à la base de données pour les opérations sur les utilisateurs
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 25, 37
 */

const { query } = require("../../config/db");
const { generateInvitationCode } = require("../../utils/codeGenerator");

/**
 * Trouve un utilisateur par son ID
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
async function findUserById(userId) {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      is_root,
      is_leader,
      link_active,
      invitation_code,
      point_focal_link,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Trouve un utilisateur par son email
 * 
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
async function findUserByEmail(email) {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      password_hash,
      language,
      status,
      sponsor_id,
      is_root,
      is_leader,
      link_active,
      invitation_code,
      point_focal_link,
      created_at
    FROM users
    WHERE email = $1
    `,
    [email.toLowerCase().trim()]
  );

  return result.rows[0] || null;
}

/**
 * Trouve un utilisateur par son code d'invitation
 * 
 * @param {string} invitationCode - Code d'invitation
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
async function findUserByInvitationCode(invitationCode) {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      is_root,
      is_leader,
      link_active,
      invitation_code,
      point_focal_link
    FROM users
    WHERE invitation_code = $1
    `,
    [invitationCode.toUpperCase().trim()]
  );

  return result.rows[0] || null;
}

/**
 * Crée un nouvel utilisateur
 * 
 * @param {Object} userData - Données de l'utilisateur
 * @returns {Promise<Object>} - Utilisateur créé
 */
async function createUser({
  email,
  whatsapp,
  passwordHash,
  language = "fr",
  sponsorId = null,
  invitationCode,
  isRoot = false,
  isLeader = false
}) {
  const result = await query(
    `
    INSERT INTO users (
      email,
      whatsapp,
      password_hash,
      language,
      status,
      sponsor_id,
      invitation_code,
      is_root,
      is_leader,
      link_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      invitation_code,
      is_root,
      is_leader,
      link_active
    `,
    [
      email.toLowerCase().trim(),
      whatsapp.trim(),
      passwordHash,
      language,
      "pending",
      sponsorId,
      invitationCode.toUpperCase().trim(),
      isRoot,
      isLeader,
      false
    ]
  );

  return result.rows[0];
}

/**
 * Met à jour le statut d'un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string} status - Nouveau statut
 * @returns {Promise<Object|null>} - Utilisateur mis à jour
 */
async function updateUserStatus(userId, status) {
  const result = await query(
    `
    UPDATE users
    SET
      status = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, status
    `,
    [userId, status]
  );

  return result.rows[0] || null;
}

/**
 * Active le lien POINT FOCAL d'un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string} pointFocalLink - Lien personnel POINT FOCAL
 * @returns {Promise<Object|null>} - Utilisateur mis à jour
 */
async function activatePointFocalLink(userId, pointFocalLink) {
  const result = await query(
    `
    UPDATE users
    SET
      point_focal_link = $2,
      link_active = true,
      status = 'active',
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      email,
      point_focal_link,
      link_active,
      status
    `,
    [userId, pointFocalLink]
  );

  return result.rows[0] || null;
}

/**
 * Vérifie si un email existe déjà
 * 
 * @param {string} email - Email à vérifier
 * @returns {Promise<boolean>} - True si l'email existe
 */
async function emailExists(email) {
  const result = await query(
    `
    SELECT id FROM users WHERE email = $1
    `,
    [email.toLowerCase().trim()]
  );

  return result.rows.length > 0;
}

/**
 * Vérifie si un numéro WhatsApp existe déjà
 * 
 * @param {string} whatsapp - Numéro WhatsApp à vérifier
 * @returns {Promise<boolean>} - True si le numéro existe
 */
async function whatsappExists(whatsapp) {
  const result = await query(
    `
    SELECT id FROM users WHERE whatsapp = $1
    `,
    [whatsapp.trim()]
  );

  return result.rows.length > 0;
}

/**
 * Vérifie si un code d'invitation existe déjà
 * 
 * @param {string} invitationCode - Code d'invitation à vérifier
 * @returns {Promise<boolean>} - True si le code existe
 */
async function invitationCodeExists(invitationCode) {
  const result = await query(
    `
    SELECT id FROM users WHERE invitation_code = $1
    `,
    [invitationCode.toUpperCase().trim()]
  );

  return result.rows.length > 0;
}

/**
 * Génère un nouveau code d'invitation unique
 * 
 * @param {number} maxAttempts - Nombre maximal de tentatives
 * @returns {Promise<string>} - Code d'invitation unique
 */
async function generateUniqueInvitationCode(maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateInvitationCode();

    const exists = await invitationCodeExists(code);

    if (!exists) {
      return code;
    }
  }

  throw new Error("Impossible de générer un code d'invitation unique.");
}

/**
 * Met à jour la langue d'un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string} language - Code langue (fr, en, es, pt, ar, hi)
 * @returns {Promise<Object|null>} - Utilisateur mis à jour
 */
async function updateUserLanguage(userId, language) {
  const result = await query(
    `
    UPDATE users
    SET
      language = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, language
    `,
    [userId, language]
  );

  return result.rows[0] || null;
}

/**
 * Récupère les filleuls d'un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des filleuls
 */
async function getChildren(userId) {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      status,
      link_active,
      created_at
    FROM users
    WHERE sponsor_id = $1
    ORDER BY created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

/**
 * Compte les filleuls d'un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @returns {Promise<number>} - Nombre de filleuls
 */
async function countChildren(userId) {
  const result = await query(
    `
    SELECT COUNT(*) as count
    FROM users
    WHERE sponsor_id = $1
    `,
    [userId]
  );

  return parseInt(result.rows[0]?.count || 0, 10);
}

/**
 * Trouve la racine du système
 * 
 * @returns {Promise<Object|null>} - Utilisateur racine
 */
async function findRoot() {
  const result = await query(
    `
    SELECT
      id,
      email,
      invitation_code,
      point_focal_link,
      link_active
    FROM users
    WHERE is_root = true
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

/**
 * Récupère les leaders (is_leader = true)
 * 
 * @param {number} limit - Nombre maximum de leaders
 * @returns {Promise<Array>} - Liste des leaders
 */
async function getLeaders(limit = 50) {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      status,
      link_active,
      invitation_code,
      point_focal_link,
      created_at
    FROM users
    WHERE is_leader = true
    ORDER BY created_at ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/**
 * Compte les leaders
 * 
 * @returns {Promise<number>} - Nombre de leaders
 */
async function countLeaders() {
  const result = await query(
    `
    SELECT COUNT(*) as count
    FROM users
    WHERE is_leader = true
    `
  );

  return parseInt(result.rows[0]?.count || 0, 10);
}

module.exports = {
  findUserById,
  findUserByEmail,
  findUserByInvitationCode,
  createUser,
  updateUserStatus,
  activatePointFocalLink,
  emailExists,
  whatsappExists,
  invitationCodeExists,
  generateUniqueInvitationCode,
  updateUserLanguage,
  getChildren,
  countChildren,
  findRoot,
  getLeaders,
  countLeaders
};