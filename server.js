const http = require("http");
const pool = require("./db");

const video = require("./modules/video");
const payment = require("./modules/payment");
const victory = require("./modules/victory");
const mlm = require("./modules/mlm");
const opportunity = require("./modules/opportunity");

const server = http.createServer(async (req, res) => {

  if (req.url === "/api/video/start") return video.start(req, res);
  if (req.url === "/api/video/complete") return video.complete(req, res);

  if (req.url === "/api/victory/generate") return victory.generate(req, res);
  if (req.url === "/api/victory/validate") return victory.validate(req, res);

  if (req.url === "/api/payment/verify") return payment.verify(req, res);

  if (req.url === "/api/opportunity/add") return opportunity.add(req, res);

  if (req.url === "/api/mlm/init") return mlm.init(req, res);

  res.end(JSON.stringify({ error: "route not found" }));
});

server.listen(3000);