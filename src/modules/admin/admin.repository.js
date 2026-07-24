
const db = require("../../config/db");

async function getDashboardStats() {
  const usersResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    `
  );

  const leadersResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_leader = true
    `
  );

  const paymentsResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM payments
    `
  );

  const opportunitiesResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM campaigns
    `
  );

  return {
    users:
      usersResult.rows[0]?.total || 0,

    leaders:
      leadersResult.rows[0]?.total || 0,

    payments:
      paymentsResult.rows[0]?.total || 0,

    opportunities:
      opportunitiesResult.rows[0]?.total || 0
  };
}
async function getUsers() {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      whatsapp,
      is_leader,
      created_at
    FROM users
    ORDER BY id DESC
    `
  );

  return result.rows;
}
async function createOpportunity(data) {
  const {
    name,
    description,
    status,
    prelaunchEnabled,
    publicOpen,
    defaultLanguage
  } = data;

  const result = await db.query(
    `
    INSERT INTO campaigns (
      name,
      description,
      status,
      prelaunch_enabled,
      public_open,
      default_language
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
    )
    RETURNING
      id,
      name,
      description,
      status,
      prelaunch_enabled,
      public_open,
      default_language,
      created_at
    `,
    [
      name,
      description,
      status,
      prelaunchEnabled,
      publicOpen,
      defaultLanguage
    ]
  );

  return result.rows[0];
}
module.exports = {
  getDashboardStats,
  getUsers,
  createOpportunity
};