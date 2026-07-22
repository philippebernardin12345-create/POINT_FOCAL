const opportunityService = require("./opportunities.service");

async function getAll(req, res) {
  try {
    const opportunities = await opportunityService.getAllOpportunities();

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
    const opportunities = await opportunityService.getActiveOpportunities();

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

module.exports = {
  getAll,
  getActive,
  getNext
};
