const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, "../migrations");

async function ensureSchemaMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

function listMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
}

async function getAppliedVersions(client) {
  const result = await client.query(
    "SELECT version FROM schema_migrations ORDER BY version ASC"
  );

  return new Set(result.rows.map((row) => row.version));
}

async function runMigrationFile(client, filePath, version) {
  const sql = fs.readFileSync(filePath, "utf8");

  await client.query(sql);
  await client.query(
    `
    INSERT INTO schema_migrations (version, filename)
    VALUES ($1, $2)
    ON CONFLICT (version) DO NOTHING
    `,
    [version, path.basename(filePath)]
  );
}

async function runPendingMigrations(options = {}) {
  const migrationsDir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR;

  if (options.client) {
    await ensureSchemaMigrations(options.client);
    const appliedVersions = await getAppliedVersions(options.client);
    const applied = [];

    for (const filename of listMigrationFiles(migrationsDir)) {
      const version = path.basename(filename, ".sql");

      if (appliedVersions.has(version)) {
        continue;
      }

      await runMigrationFile(
        options.client,
        path.join(migrationsDir, filename),
        version
      );
      applied.push(version);
    }

    return applied;
  }

  return db.withTransaction(async (client) => {
    await ensureSchemaMigrations(client);
    const appliedVersions = await getAppliedVersions(client);
    const applied = [];

    for (const filename of listMigrationFiles(migrationsDir)) {
      const version = path.basename(filename, ".sql");

      if (appliedVersions.has(version)) {
        continue;
      }

      await runMigrationFile(
        client,
        path.join(migrationsDir, filename),
        version
      );
      applied.push(version);
    }

    return applied;
  });
}

module.exports = {
  DEFAULT_MIGRATIONS_DIR,
  ensureSchemaMigrations,
  listMigrationFiles,
  runPendingMigrations
};
