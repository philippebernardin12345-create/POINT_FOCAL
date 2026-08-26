/**
 * POINT FOCAL V10.4 - Application Express
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 35
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");
const { errorMiddleware, notFoundHandler } = require("./middlewares/error.middleware");
const { logger } = require("./utils/logger");

// Registre des modules d'opportunité (chargé au démarrage dans server.js)

const app = express();

// ─── Sécurité : Headers HTTP ──────────────────────────────────────────────
app.use(helmet());

// ─── Sécurité : CORS ────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:5000"];

app.use(
  cors({
    origin: (origin, callback) => {
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

// ─── Sécurité : Rate Limiting ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Trop de requêtes. Veuillez réessayer dans 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  },
});

app.use(limiter);

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Logging des requêtes ──────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers["user-agent"]
  });
  next();
});

// ─── Routes de santé ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Point Focal Backend V10.4",
    version: "10.4.0"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Point Focal Backend V10.4",
    version: "10.4.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ─── Routes API ─────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── Gestion des erreurs ───────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorMiddleware);

module.exports = app;