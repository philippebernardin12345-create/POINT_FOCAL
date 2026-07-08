const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    opportunity: "Victory World",
    status: "Disponible"
  });
});

module.exports = router;
