const { runMigrations } = require("../db/migration-runner");

async function main() {
  try {
    await runMigrations({ closePool: true });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
