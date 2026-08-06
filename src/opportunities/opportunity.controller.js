const opportunityService = require("./opportunities.service");

async function getAll(req, res) {
  try {
    const opportunities =
      await opportunityService.getAllOpportunities();

    return res.json({
      success: true,
      data: opportunities
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des opportunités."
    });
  }
}


async function getActive(req, res) {
  try {
    const opportunities =
      await opportunityService.getActiveOpportunities();

    return res.json({
      success: true,
      data: opportunities
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des opportunités actives."
    });
  }
}


async function getEntry(req, res) {
  try {
    const opportunity =
      await opportunityService.getActiveEntryOpportunity();

    return res.json({
      success: true,
      data: opportunity
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors du chargement de l'opportunité d'entrée."
    });
  }
}


async function getNext(req, res) {
  try {
    const position = Number(req.params.position);

    const nextOpportunity =
      await opportunityService.getNextOpportunity(position);

    return res.json({
      success: true,
      data: nextOpportunity
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la recherche de la prochaine opportunité."
    });
  }
}


async function registerFollowMeLink(req, res) {
  try {
    const {
      opportunityId,
      assignedSponsorLink,
      personalLink,
      realParentLink
    } = req.body;

    const result =
      await opportunityService.registerFollowMeLink({
        userId: req.user.id,
        opportunityId,
        assignedSponsorLink,
        personalLink,
        realParentLink
      });

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}


module.exports = {
  getAll,
  getActive,
  getEntry,
  getNext,
  registerFollowMeLink
};