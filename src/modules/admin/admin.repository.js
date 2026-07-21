
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

module.exports = {
  getDashboardStats
};