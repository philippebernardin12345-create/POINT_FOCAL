const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  family: 4
});

function resolveExecutor(client) {
  return client || pool;
}

function query(text, params, client) {
  return resolveExecutor(client).query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function withTransaction(callback) {
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }

    throw error;
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