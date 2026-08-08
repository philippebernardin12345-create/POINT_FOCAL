const repo = require('./user-opportunities.repository');
const { findOpportunityBySlug } = require('../../opportunities/opportunities.repository');

const saveUserLink = async (userId, { opportunitySlug, referralLink, targetAddress, paymentHash }) => {
  const opportunity = await findOpportunityBySlug(opportunitySlug);
  if (!opportunity) throw new Error('Opportunité introuvable');

  if (opportunity.slug === 'victory-automatic') {
    if (!referralLink || !targetAddress || !paymentHash) {
      throw new Error('Victory Automatic exige : referral_link, target_address et payment_hash');
    }
  } else {
    if (!referralLink) {
      throw new Error('Le lien de opportunite est obligatoire');
    }
  }

  return await repo.saveUserOpportunityLink({
    userId,
    opportunityId: opportunity.id,
    referralLink,
    targetAddress,
    paymentHash
  });
};

const getAvailableLink = async (opportunitySlug) => {
  const opportunity = await findOpportunityBySlug(opportunitySlug);
  if (!opportunity) throw new Error('Opportunité introuvable');
  return await repo.getAvailableLinkForOpportunity(opportunity.id);
};

const getUserLinks = async (userId) => {
  return await repo.getUserOpportunityLinks(userId);
};

module.exports = { saveUserLink, getAvailableLink, getUserLinks };
 

 

 