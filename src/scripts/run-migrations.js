#!/usr/bin/env node
"use strict";

/**
 * run-migrations.js
 * Point d'entrée CLI pour appliquer les migrations V10.6.
 * Usage : node src/scripts/run-migrations.js
 */

require("dotenv").config();

const { runMigrations } = require("../db/migration-runner");

runMigrations()
  .then(() => {
    console.log("[run-migrations] Terminé avec succès.");
    process.exit(0);
  })
  .catch(err => {
    console.error("[run-migrations] ERREUR :", err.message);
    process.exit(1);
  });
