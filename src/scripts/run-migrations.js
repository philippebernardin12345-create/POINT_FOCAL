require("dotenv").config();

const { runMigrations } = require("../db/migration-runner");

runMigrations()
  .then(() => {
    console.log("Migrations appliquées avec succès.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Échec des migrations:", error);
    process.exit(1);
  });
