/**
 * POINT FOCAL V10.6 - Repository Utilisateurs
 *
 * Repository CORE minimal.
 *
 * V10.6 :
 * - Un seul code d'invitation par utilisateur : invitation_code.
 * - Le sponsor réel est users.sponsor_id.
 * - Les anciennes séries ne sont plus utilisées.
 */

const { query } = require("../../config/db");

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

async function findRoot() {
  const result = await query(
    `
      SELECT u.*
      FROM users u
      JOIN v106_runtime_state rs
        ON rs.root_user_id = u.id
      WHERE rs.singleton_id = true
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
