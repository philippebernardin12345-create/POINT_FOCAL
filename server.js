const http = require("http");
const pool = require("./db");

// Importation des modules applicatifs
const video = require("./modules/video");
const payment = require("./modules/payment");
const victory = require("./modules/victory");
const mlm = require("./modules/mlm");
const opportunity = require("./modules/opportunity");

// 🔐 Importation du module d'authentification
const auth = require("./modules/auth");

const server = http.createServer(async (req, res) => {

  // ==========================================
  // 🔓 ROUTES PUBLIQUES (Accessibles sans token)
  // ==========================================
  if (req.url === "/api/auth/register") return auth.register(req, res);
  if (req.url === "/api/auth/login") return auth.login(req, res);


  // ==========================================
  // 🛡️ ENFORCEMENT DE LA SÉCURITÉ (Middleware)
  // ==========================================
  // Toutes les routes situées en dessous de ce bloc requièrent 
  // obligatoirement un Token JWT valide.
  
  const user = auth.verifyToken(req);
  
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Accès refusé. Token invalide ou manquant." }));
  }

  // 💡 Astuce : Tu peux injecter l'ID de l'utilisateur directement dans l'objet 'req' 
  // pour que tes autres modules (victory, mlm...) sachent qui fait la demande.
  req.userId = user.userId;


  // ==========================================
  // 🔒 ROUTES SÉCURISÉES (Token requis)
  // ==========================================
  if (req.url === "/api/video/start") return video.start(req, res);
  if (req.url === "/api/video/complete") return video.complete(req, res);

  if (req.url === "/api/victory/generate") return victory.generate(req, res);
  if (req.url === "/api/victory/validate") return victory.validate(req, res);

  if (req.url === "/api/payment/verify") return payment.verify(req, res);

  if (req.url === "/api/opportunity/add") return opportunity.add(req, res);

  if (req.url === "/api/mlm/init") return mlm.init(req, res);

  // Si aucune route ne correspond
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "route not found" }));
});

server.listen(3000, () => {
  console.log("🚀 Serveur Point Focal démarré sur le port 3000");
});