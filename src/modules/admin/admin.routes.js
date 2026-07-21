const express = require("express");

const controller =
    require("./admin.controller");

const adminMiddleware =
    require("../../middlewares/admin.middleware");

const router = express.Router();


// Connexion publique
router.post(
    "/login",
    controller.login
);


// Routes protégées
router.get(
    "/dashboard",
    adminMiddleware,
    controller.dashboard
);

router.get(
    "/users",
    adminMiddleware,
    controller.users
);

router.get(
    "/settings",
    adminMiddleware,
    controller.settings
);

module.exports = router;