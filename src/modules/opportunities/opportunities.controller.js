

 const opportunitiesRepository = require('./opportunities.repository');
const opportunityService = require("./opportunities.service");

// ─── Toutes les opportunités ─────────────────────────────────────────────────
async function getAll(req, res) {
  try {
    const opportunities = await opportunityService.getAllOpportunities();

    return res.json({
      success: true,
      data: opportunities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des opportunités.",
    });
  }
}

// ─── Opportunités actives seulement ─────────────────────────────────────────
async function getActive(req, res) {
  try {
    const opportunities = await opportunityService.getActiveOpportunities();

    return res.json({
      success: true,
      data: opportunities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des opportunités actives.",
    });
  }
}

// ─── Opportunité d'entrée du parcours ───────────────────────────────────────
async function getEntry(req, res) {
  try {
    const opportunity = await opportunityService.getActiveEntryOpportunity();

    return res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement de l'opportunité d'entrée.",
    });
  }
}

// ─── Prochaine opportunité selon position ───────────────────────────────────
async function getNext(req, res) {
  try {
    const position = Number(req.params.position);

    if (isNaN(position)) {
      return res.status(400).json({
        success: false,
        message: "Position invalide.",
      });
    }

    const nextOpportunity = await opportunityService.getNextOpportunity(position);

    return res.json({
      success: true,
      data: nextOpportunity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la recherche de la prochaine opportunité.",
    });
  }
}

// ─── Opportunité par ID ──────────────────────────────────────────────────────
async function getById(req, res) {
  try {
    const opportunity = await opportunityService.getOpportunityById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunité introuvable.",
      });
    }

    return res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement de l'opportunité.",
    });
  }
}

// ─── Opportunité par slug ────────────────────────────────────────────────────
async function getBySlug(req, res) {
  try {
    const opportunity = await opportunityService.getOpportunityBySlug(req.params.slug);

    return res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    if (error.message === "Opportunité introuvable.") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement de l'opportunité.",
    });
  }
}

// ─── Opportunités éligibles pour l'utilisateur connecté ─────────────────────
async function getEligible(req, res) {
  try {
    const opportunities = await opportunityService.getEligibleOpportunities(
      req.user.id
    );

    return res.json({
      success: true,
      data: opportunities,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// ─── Enregistrement d'un lien Follow Me ─────────────────────────────────────
async function registerFollowMeLink(req, res) {
  try {
    const {
      opportunityId,
      assignedSponsorLink,
      personalLink,
      realParentLink,
    } = req.body;

    const result = await opportunityService.registerFollowMeLink({
      userId: req.user.id,
      opportunityId,
      assignedSponsorLink,
      personalLink,
      realParentLink,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  getAll,
  getActive,
  getEntry,
  getNext,
  getById,
  getBySlug,
  getEligible,
  registerFollowMeLink,
};
 

 

