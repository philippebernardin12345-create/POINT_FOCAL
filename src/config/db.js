const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  family: 4
});

const query = (text, params, client = null) => {
  if (client) {
    return client.query(text, params);
  }

  return pool.query(text, params);
};

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Preserve the original transaction error.
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  pool,
  withTransaction
};
