
const express = require("express");

const controller = require("./admin.controller");

const router = express.Router();

router.post(
    "/login",
    controller.login
);

router.get(
    "/dashboard",
    controller.dashboard
);

router.get(
    "/users",
    controller.users
);

router.get(
    "/settings",
    controller.settings
);

module.exports = router;