require("dotenv").config();

const app = require("./app");
const registry = require("./modules/opportunities/registry");
const opportunityRepository = require("./modules/opportunities/opportunities.repository");

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Charge les modules d'opportunité depuis la base AVANT de démarrer le serveur
    await registry.loadFromDatabase(opportunityRepository);
    console.log("[Startup] Registre chargé depuis la base.");

    app.listen(PORT, () => {
      console.log(`Point Focal Backend V10 running on port ${PORT}`);
    });
  } catch (err) {
    console.error("[Startup] Échec du chargement du registre:", err);
    process.exit(1);
  }
}

start();