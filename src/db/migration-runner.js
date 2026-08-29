"use strict";

/**
 * migration-runner.js
 * Exécute les fichiers SQL de src/migrations/ dans l'ordre de version.
 * Idempotent grâce à schema_migrations.
 */

const fs   = require("fs");
const path = require("path");
const { withTransaction } = require("../config/db");

const MIGRATIONS_DIR = path.join(__dirname, "../migrations");

/**
 * Retourne la liste triée des fichiers .sql du répertoire de migrations.
 */
function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();
}

/**
 * Retourne l'ensemble des versions déjà appliquées.
 */
async function appliedVersions(client) {
  const res = await client.query("SELECT version FROM schema_migrations");
  return new Set(res.rows.map(r => r.version));
}

/**
 * Extrait le numéro de version depuis le nom de fichier (ex: "001_...sql" → "001").
 */
function versionFromFilename(filename) {
  return filename.split("_")[0];
}

/**
 * Applique toutes les migrations en attente, dans l'ordre.
 * Chaque migration est exécutée dans sa propre transaction.
 */
async function runMigrations() {
  const files   = listMigrationFiles();
  const applied = new Set();

  // Lire les versions appliquées (hors transaction pour ne pas bloquer)
  try {
    const { query } = require("../config/db");
    const res = await query("SELECT version FROM schema_migrations");
    res.rows.forEach(r => applied.add(r.version));
  } catch (_) {
    // schema_migrations n'existe pas encore — première exécution
  }

  let count = 0;
  for (const file of files) {
    const version = versionFromFilename(file);
    if (applied.has(version)) {
      console.log(`[migrations] Déjà appliquée : ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrations] Application de : ${file} …`);

    await withTransaction(async (client) => {
      await client.query(sql);
    });

    console.log(`[migrations] Appliquée      : ${file}`);
    count++;
  }

  if (count === 0) {
    console.log("[migrations] Aucune migration en attente.");
  } else {
    console.log(`[migrations] ${count} migration(s) appliquée(s).`);
  }
}

module.exports = { runMigrations, listMigrationFiles };
