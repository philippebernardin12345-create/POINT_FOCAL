const express = require("express");
const cors = require("cors");

const routes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Point Focal Backend V9"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Point Focal Backend V9",
    version: "9.0.0",
    timestamp: new Date().toISOString()
  });
});

app.use("/api", routes);

module.exports = app;