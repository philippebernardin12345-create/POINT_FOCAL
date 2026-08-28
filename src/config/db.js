const { Pool } = require("pg");

const isLocalDatabase =
  !process.env.DATABASE_URL ||
  /@(localhost|127\.0\.0\.1)(:|\/|$)/i.test(
    process.env.DATABASE_URL
  );

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized: false
      },
  family: 4
});

async function getClient() {
  return pool.connect();
}

async function withTransaction(work) {
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const result = await work(client);
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
  query: (text, params) => pool.query(text, params),
  getClient,
  withTransaction,
  pool
};