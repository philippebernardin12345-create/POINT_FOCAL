const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  family: 4
});

/**
 * Execute a single query on the pool.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtain a dedicated client from the pool (caller must release).
 */
const getClient = () => pool.connect();

/**
 * Execute fn(client) inside a BEGIN/COMMIT transaction.
 * Automatically rolls back and releases on error.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  getClient,
  withTransaction,
  pool
};