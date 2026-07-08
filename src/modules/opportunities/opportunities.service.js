
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

module.exports = {
  getActiveOpportunities,
  getAllOpportunities,
  getOpportunityById
};