
const db = require("../../config/database");

async function findAllActive() {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE active = true
    ORDER BY position ASC
    `
  );

  return result.rows;
}

async function findAll() {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    ORDER BY position ASC
    `
  );

  return result.rows;
}

async function findById(id) {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  findAllActive,
  findAll,
  findById
};