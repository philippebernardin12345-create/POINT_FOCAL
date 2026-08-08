
const express = require('express');
const router = express.Router();
const controller = require('./user-opportunities.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

// Sauvegarder son lien pour une opportunité
router.post('/link', authenticate, controller.saveLink);

// Récupérer ses propres liens
router.get('/my-links', authenticate, controller.getUserLinks);

// Récupérer un lien disponible pour le Follow Me
router.get('/:opportunitySlug/available', authenticate, controller.getAvailableLink);

module.exports = router;