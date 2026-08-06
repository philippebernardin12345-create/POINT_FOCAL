
const opportunityService = require("./opportunity.service");
const supabase = require("../../config/supabase");


const getOpportunities = async (req, res) => {
  try {

    const opportunities =
      await opportunityService.getAllOpportunities(supabase);

    res.json({
      success: true,
      opportunities
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


const getEntryOpportunity = async (req, res) => {
  try {

    const opportunity =
      await opportunityService.getActiveEntryOpportunity(supabase);✋async function getEntry(req, res) {
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

    res.json({
      success: true,
      opportunity
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


module.exports = {
  getOpportunities,
  getEntryOpportunity
};