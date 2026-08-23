/**
 * POINT FOCAL V10.4 - Point d'entrée du serveur
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 35
 */

require("dotenv").config();
require("dotenv").config();

const dbUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : null;

console.log("[DB CONFIG]", {
  host: dbUrl?.hostname,
  port: dbUrl?.port,
  username: dbUrl?.username,
  database: dbUrl?.pathname,
  password_present: !!dbUrl?.password,
  password_length: dbUrl?.password?.length
});

const app = require("./app");
// Bloc de configuration DB ajouté ici
const dbUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : null;

console.log("[DB CONFIG]", {
  host: dbUrl?.hostname,
  port: dbUrl?.port,
  username: dbUrl?.username,
  database: dbUrl?.pathname,
  password_present: !!dbUrl?.password,
  password_length: dbUrl?.password?.length
});

const app = require("./app");
const registry = require("./modules/opportunities/registry");
const opportunityRepository = require("./modules/opportunities/opportunities.repository");
const { logger } = require("./utils/logger");

const PORT = process.env.PORT || 5000;

/**
 * Démarre le serveur
 */
async function startServer() {
  try {
    // 1. Charger les modules d'opportunité depuis la base
    logger.info("[Startup] Chargement du registre des opportunités...");
    
    await registry.loadFromDatabase(opportunityRepository);
    
    logger.info(`[Startup] Registre chargé : ${registry.list().length} modules actifs.`);

    // 2. Démarrer le serveur HTTP
    app.listen(PORT, () => {
      logger.info(`[Startup] Point Focal Backend V10.4 démarré sur le port ${PORT}`);
      logger.info(`[Startup] Environnement : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`[Startup] API disponible : http://localhost:${PORT}/api`);
    });

    // 3. Gestion des signaux d'arrêt
    process.on("SIGTERM", () => {
      logger.info("[Shutdown] Réception de SIGTERM, arrêt du serveur...");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("[Shutdown] Réception de SIGINT, arrêt du serveur...");
      process.exit(0);
    });

  } catch (error) {
    logger.error("[Startup] Échec du démarrage:", error);
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();