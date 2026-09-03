

 
const db = require("../../config/db");

async function findUserById(userId) {
  const result = await db.query(
    `SELECT *
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function findOpportunityBySlug(slug) {
  const result = await db.query(
    `SELECT *
     FROM opportunities
     WHERE slug = $1
       AND status = 'active'
     LIMIT 1`,
    [slug]
  );
  return result.rows[0] || null;
}

async function findUserOpportunity(userId, opportunityId) {
  const result = await db.query(
    `SELECT *
     FROM user_opportunities
     WHERE user_id = $1
       AND opportunity_id = $2
     LIMIT 1`,
    [userId, opportunityId]
  );
  return result.rows[0] || null;
}

module.exports = {
  findUserById,
  findOpportunityBySlug,
  findUserOpportunity,
};
 
