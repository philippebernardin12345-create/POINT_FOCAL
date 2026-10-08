/**
 * POINT FOCAL V10.4 - Routes Opportunités
 */

const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const opportunitiesController = require("./opportunities.controller");
const inactivityController = require("./opportunity-inactivity.controller");

router.get("/", opportunitiesController.getAll);
router.get("/active", opportunitiesController.getActive);
router.get("/my-progress", authenticate, opportunitiesController.getMyProgress);
router.get("/entry", authenticate, opportunitiesController.getEntry);
router.get("/generator", authenticate, opportunitiesController.getGenerator);
router.get("/next", authenticate, opportunitiesController.getNext);

/*
 * S1 — Signalement d'inactivité.
 * Le client n'envoie PAS le lien à vérifier : PF récupère le referral_link
 * déjà attribué à l'utilisateur pour l'opportunité. Cela empêche de faire
 * vérifier arbitrairement une URL tierce via cette route.
 */
router.post("/inactivity/report", authenticate, inactivityController.report);

/* Garder la route paramétrique après les routes fixes. */
router.get("/:slug", opportunitiesController.getBySlug);
router.post("/followme", authenticate, opportunitiesController.registerFollowMeLink);

module.exports = router;
