const fs = require("node:fs/promises");
const path = require("node:path");

const { pool } = require("../config/db");

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");
const CREATE_SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

function sortMigrations(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

async function listMigrationFiles(migrationsDir = MIGRATIONS_DIR) {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".sql")
    .map((entry) => ({
      name: entry.name,
      path: path.join(migrationsDir, entry.name)
    }))
    .sort((left, right) => sortMigrations(left.name, right.name));
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(CREATE_SCHEMA_MIGRATIONS_SQL);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    "SELECT filename FROM schema_migrations"
  );

  return new Set(rows.map((row) => row.filename));
}

async function applyMigration(client, migration) {
  const sql = await fs.readFile(migration.path, "utf8");

  await client.query("BEGIN");

  try {
    if (sql.trim()) {
      await client.query(sql);
    }

    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [migration.name]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.message = `Migration failed (${migration.name}): ${error.message}`;
    throw error;
  }
}

async function runMigrations(options = {}) {
  const {
    migrationsDir = MIGRATIONS_DIR,
    dbPool = pool,
    closePool = true
  } = options;

  let client;

  try {
    const migrations = await listMigrationFiles(migrationsDir);

    client = await dbPool.connect();

    await ensureSchemaMigrationsTable(client);

    const appliedMigrations = await getAppliedMigrations(client);
    const executedMigrations = [];

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.name)) {
        continue;
      }

      await applyMigration(client, migration);
      appliedMigrations.add(migration.name);
      executedMigrations.push(migration.name);
    }

    return {
      migrationsDir,
      discoveredMigrations: migrations.map((migration) => migration.name),
      executedMigrations
    };
  } finally {
    if (client) {
      client.release();
    }

    if (closePool && dbPool && typeof dbPool.end === "function") {
      await dbPool.end();
    }
  }
}

module.exports = {
  MIGRATIONS_DIR,
  applyMigration,
  ensureSchemaMigrationsTable,
  getAppliedMigrations,
  listMigrationFiles,
  runMigrations,
  sortMigrations
};
