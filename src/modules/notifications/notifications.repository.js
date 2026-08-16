
/**
 * POINT FOCAL V10.4 - Repository Notifications
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 37
 */

const { query } = require("../../config/db");

/**
 * Récupère les notifications d'un utilisateur
 */
async function findByUserId(userId, page = 1, limit = 20, read = undefined) {
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT *
    FROM notifications
    WHERE user_id = $1
  `;

  const params = [userId];

  if (read !== undefined) {
    queryText += ` AND read = $${params.length + 1}`;
    params.push(read);
  }

  // Total
  const countQuery = queryText.replace(/SELECT.*FROM/, "SELECT COUNT(*) as count FROM");
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || 0, 10);

  // Pagination
  queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(queryText, params);

  return {
    notifications: result.rows,
    total
  };
}

/**
 * Récupère une notification par son ID
 */
async function findById(notificationId) {
  const result = await query(
    `
    SELECT *
    FROM notifications
    WHERE id = $1
    `,
    [notificationId]
  );

  return result.rows[0] || null;
}

/**
 * Compte les notifications non lues d'un utilisateur
 */
async function countUnread(userId) {
  const result = await query(
    `
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = $1 AND read = false
    `,
    [userId]
  );

  return parseInt(result.rows[0]?.count || 0, 10);
}

/**
 * Crée une notification
 */
async function create({ userId, type, title, message, language = 'fr', data = null }) {
  const result = await query(
    `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      language,
      data,
      read,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
    RETURNING *
    `,
    [userId, type, title, message, language, data]
  );

  return result.rows[0] || null;
}

/**
 * Marque une notification comme lue
 */
async function markAsRead(notificationId) {
  const result = await query(
    `
    UPDATE notifications
    SET read = true
    WHERE id = $1
    RETURNING *
    `,
    [notificationId]
  );

  return result.rows[0] || null;
}

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 */
async function markAllAsRead(userId) {
  const result = await query(
    `
    UPDATE notifications
    SET read = true
    WHERE user_id = $1 AND read = false
    RETURNING id
    `,
    [userId]
  );

  return result.rows.length;
}

/**
 * Supprime les notifications d'un utilisateur
 */
async function deleteByUserId(userId) {
  const result = await query(
    `
    DELETE FROM notifications
    WHERE user_id = $1
    RETURNING id
    `,
    [userId]
  );

  return result.rows.length;
}

/**
 * Récupère tous les utilisateurs actifs
 */
async function findAllActiveUsers() {
  const result = await query(
    `
    SELECT id, email, language
    FROM users
    WHERE status = 'active'
    `
  );

  return result.rows;
}

module.exports = {
  findByUserId,
  findById,
  countUnread,
  create,
  markAsRead,
  markAllAsRead,
  deleteByUserId,
  findAllActiveUsers
};