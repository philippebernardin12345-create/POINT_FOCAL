
const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const followmeController = require("./followme.controller");

const router = express.Router();

router.get(
  "/:position",
  authMiddleware,
  followmeController.getSponsorLink
);

module.exports = router;