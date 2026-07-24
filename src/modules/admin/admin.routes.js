const express = require("express");

const controller =
    require("./admin.controller");

const adminMiddleware =
    require("../../middlewares/admin.middleware");

const router =
    express.Router();


// ============================================================
// CONNEXION ADMINISTRATEUR
// ============================================================

router.post(
    "/login",
    controller.login
);


// ============================================================
// ROUTES PROTÉGÉES
// ============================================================

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

// ============================================================
// OPPORTUNITÉS
// ============================================================

router.post(
    "/opportunities",
    adminMiddleware,
    controller.createOpportunity
);

router.put(
    "/opportunities/:id",
    adminMiddleware,
    controller.updateOpportunity
);

router.post(
    "/opportunities",
    adminMiddleware,
    controller.createOpportunity
);


// ============================================================
// EXPORT
// ============================================================

module.exports =
    router;