
/**
 * POINT FOCAL V10.6 - Repository Utilisateurs
 *
 * Repository CORE minimal.
 *
 * MODÈLE V10.6 :
 * - Un seul code d'invitation par utilisateur : invitation_code.
 * - Le sponsor réel est users.sponsor_id.
 * - La gestion d'authentification appartient à auth.repository.js.
 * - La gestion administrative appartient à admin.repository.js.
 *
 * IMPORTANT :
 * Les anciennes colonnes invitation_code_series_1/2/3 peuvent
 * encore exister physiquement dans PostgreSQL pendant la migration,
 * mais elles ne sont plus utilisées par le code applicatif.
 */

const { query } = require("../../config/db");

/**
 * Trouve un utilisateur par son ID.
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
      campaign_id,
      invitation_code,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
      created_at
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Trouve un utilisateur par son code d'invitation.
 *
 * V10.6 :
 * Un utilisateur possède un seul code canonique.
 */
async function findUserByInvitationCode(invitationCode) {
  const code = String(invitationCode || "")
    .trim()
    .toUpperCase();

  if (!code) {
    return null;
  }

  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      campaign_id,
      invitation_code,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
      created_at
    FROM users
    WHERE invitation_code = $1
    LIMIT 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

/**
 * Récupère les filleuls directs d'un utilisateur.
 *
 * Le sponsor réel est users.sponsor_id.
 */
async function getChildren(userId) {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      campaign_id,
      invitation_code,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
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
 * Compte les filleuls directs d'un utilisateur.
 */
async function countChildren(userId) {
  const result = await query(
    `
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE sponsor_id = $1
    `,
    [userId]
  );

  return result.rows[0]?.count || 0;
}

/**
 * Trouve la racine du système.
 *
 * La racine est déterminée exclusivement par is_root.
 */
async function findRoot() {
  const result = await query(
    `
    SELECT
      id,
      email,
      whatsapp,
      language,
      status,
      sponsor_id,
      campaign_id,
      invitation_code,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
      created_at
    FROM users
    WHERE is_root = true
    ORDER BY created_at ASC
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserById,
  findUserByInvitationCode,
  getChildren,
  countChildren,
  findRoot
};