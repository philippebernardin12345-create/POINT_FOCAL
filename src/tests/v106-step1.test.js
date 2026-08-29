const assert = require("node:assert/strict");
const test = require("node:test");

test("migration runner files are loadable", () => {
  const migrationRunnerPath = require.resolve("../db/migration-runner");
  const runMigrationsPath = require.resolve("../scripts/run-migrations");

  const migrationRunner = require(migrationRunnerPath);
  const runMigrationsScript = require(runMigrationsPath);

  assert.equal(typeof migrationRunner.runMigrations, "function");
  assert.equal(typeof migrationRunner.listMigrationFiles, "function");
  assert.equal(typeof runMigrationsScript.main, "function");
});
