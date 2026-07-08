const opportunityRepository = require("./opportunity.repository");

async function getActiveOpportunities() {
  return await opportunityRepository.findAllActive();
}

async function getAllOpportunities() {
  return await opportunityRepository.findAll();
}

async function getOpportunityById(id) {
  return await opportunityRepository.findById(id);
}

async function getNextOpportunity(currentPosition) {
  const opportunities = await opportunityRepository.findAllActive();

  return (
    opportunities.find(
      (opportunity) => opportunity.position > currentPosition
    ) || null
  );
}

module.exports = {
  getActiveOpportunities,
  getAllOpportunities,
  getOpportunityById,
  getNextOpportunity
};