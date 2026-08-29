const { runMigrations } = require("../db/migration-runner");

async function main() {
  try {
    await runMigrations();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main
};
