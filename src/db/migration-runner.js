const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const MIGRATIONS_DIR = path.join(
  __dirname,
  "..",
  "migrations"
);

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

async function runMigrations() {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    await ensureMigrationsTable(client);

    const appliedResult = await client.query(
      "SELECT version FROM schema_migrations"
    );

    const appliedVersions = new Set(
      appliedResult.rows.map((row) => row.version)
    );

    for (const fileName of listMigrationFiles()) {
      if (appliedVersions.has(fileName)) {
        continue;
      }

      const migrationPath = path.join(
        MIGRATIONS_DIR,
        fileName
      );

      const migrationSql = fs.readFileSync(
        migrationPath,
        "utf8"
      );

      await client.query(migrationSql);
      await client.query(
        `
        INSERT INTO schema_migrations (version)
        VALUES ($1)
        `,
        [fileName]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  MIGRATIONS_DIR,
  listMigrationFiles,
  runMigrations
};
