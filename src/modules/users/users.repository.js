/**
 * POINT FOCAL V10.4 - Repository Utilisateurs
 *
 * Repository CORE minimal.
 *
 * IMPORTANT :
 * - Le schéma users V10.4 est la source de vérité.
 * - Les anciens champs invitation_code, point_focal_link
 *   et updated_at ne sont plus utilisés ici.
 * - La gestion d'authentification appartient à auth.repository.js.
 * - La gestion administrative appartient à admin.repository.js.
 */

const { query } = require("../../config/db");

/**
 * Trouve un utilisateur par son ID.
 *
 * Champs utilisés par le CORE :
 * - id
 * - email
 * - whatsapp
 * - language
 * - status
 * - sponsor_id
 * - campaign_id
 * - invitation_code_series_1
 * - invitation_code_series_2
 * - invitation_code_series_3
 * - is_root
 * - is_leader
 * - is_prelaunch_leader
 * - link_active
 * - email_confirmed
 * - created_at
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
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
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
 * Trouve un utilisateur par un code d'invitation.
 *
 * V10.4 :
 * Un utilisateur peut posséder jusqu'à trois séries configurables.
 */
async function findUserByInvitationCode(invitationCode) {
  const code = String(invitationCode || "").trim();

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
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
      is_root,
      is_leader,
      is_prelaunch_leader,
      link_active,
      email_confirmed,
      created_at
    FROM users
    WHERE invitation_code_series_1 = $1
       OR invitation_code_series_2 = $1
       OR invitation_code_series_3 = $1
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
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
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
      invitation_code_series_1,
      invitation_code_series_2,
      invitation_code_series_3,
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
