#!/usr/bin/env node

require("dotenv").config();

const { runPendingMigrations } = require("../db/migration-runner");

async function main() {
  const applied = await runPendingMigrations();

  if (applied.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  console.log(`Applied migrations: ${applied.join(", ")}`);
}

main().catch((error) => {
  console.error("Migration run failed.");
  console.error(error.message);
  process.exitCode = 1;
});
