
const express = require("express");
const router = express.Router();

const controller = require("./opportunity.controller");


router.get(
  "/",
  controller.getOpportunities
);


router.get(
  "/entry",
  controller.getEntryOpportunity
);


module.exports = router;