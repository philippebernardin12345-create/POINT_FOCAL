require("dotenv").config();
const registry = require("./modules/opportunities/registry");

// Simulation : On enregistre les deux opportunités existantes comme modules
// Plus tard, ces modules auront leurs propres dossiers exports
registry.register("victory-automatic", { name: "Victory Automatic", requiresLink: true });
registry.register("victory-world", { name: "Victory World", requiresLink: true });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// ─── Sécurité : Headers HTTP ───────────────────────────────────────────────
app.use(helmet());

// ─── Sécurité : CORS ────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin (ex: Postman, mobile)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ─── Sécurité : Rate Limiting ───────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requêtes par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Trop de requêtes. Veuillez réessayer dans 15 minutes.",
  },
});

app.use(limiter);

// ─── Parsing ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes de santé ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Point Focal Backend V10",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Point Focal Backend V10",
    version: "10.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes API ─────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── Gestion des erreurs ────────────────────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;