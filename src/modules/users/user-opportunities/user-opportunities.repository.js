

 
const pool = require('../../../config/db');

const saveUserOpportunityLink = async ({
  userId,
  opportunityId,
  referralLink,
  targetAddress = null,
  paymentHash = null
}) => {
  const result = await pool.query(
    `INSERT INTO user_opportunities
      (user_id, opportunity_id, referral_link, target_address, payment_hash, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     ON CONFLICT (user_id, opportunity_id)
     DO UPDATE SET
       referral_link = EXCLUDED.referral_link,
       target_address = EXCLUDED.target_address,
       payment_hash = EXCLUDED.payment_hash,
       updated_at = NOW()
     RETURNING *`,
    [userId, opportunityId, referralLink, targetAddress, paymentHash]
  );
  return result.rows[0];
};

const getAvailableLinkForOpportunity = async (opportunityId) => {
  const result = await pool.query(
    `SELECT uo.*, u.username
     FROM user_opportunities uo
     JOIN users u ON u.id = uo.user_id
     WHERE uo.opportunity_id = $1
       AND uo.status = 'active'
     ORDER BY uo.joined_at ASC
     LIMIT 1`,
    [opportunityId]
  );
  return result.rows[0] || null;
};

const getUserOpportunityLinks = async (userId) => {
  const result = await pool.query(
    `SELECT uo.*, o.name, o.slug
     FROM user_opportunities uo
     JOIN opportunities o ON o.id = uo.opportunity_id
     WHERE uo.user_id = $1
     ORDER BY o.position ASC`,
    [userId]
  );
  return result.rows;
};

module.exports = {
  saveUserOpportunityLink,
  getAvailableLinkForOpportunity,
  getUserOpportunityLinks
};
 
