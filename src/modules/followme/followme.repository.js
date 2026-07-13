const db = require("../../config/db");

async function findUserById(userId) {
  const result = await db.query(
    `
    SELECT *
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findOpportunityByPosition(position) {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE position = $1
      AND is_active = true
    LIMIT 1
    `,
    [position]
  );

  return result.rows[0] || null;
}

async function findUserOpportunity(
  userId,
  opportunityId
) {
  const result = await db.query(
    `
    SELECT *
    FROM user_opportunities
    WHERE user_id = $1
      AND opportunity_id = $2
    LIMIT 1
    `,
    [userId, opportunityId]
  );

  return result.rows[0] || null;
}

async function findRootUser() {
  const result = await db.query(
    `
    SELECT *
    FROM users
    WHERE is_root = true
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}
async function saveUserOpportunityLink(
  userId,
  opportunityId,
  sponsorUserId,
  referralLink
) {
  const result = await db.query(
    `
    INSERT INTO user_opportunities (
      user_id,
      opportunity_id,
      sponsor_user_id,
      referral_link,
      status,
      joined_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'completed',
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, opportunity_id)
    DO UPDATE SET
      sponsor_user_id = EXCLUDED.sponsor_user_id,
      referral_link = EXCLUDED.referral_link,
      status = 'completed',
      joined_at = COALESCE(
        user_opportunities.joined_at,
        NOW()
      ),
      updated_at = NOW()
    RETURNING *
    `,
    [
      userId,
      opportunityId,
      sponsorUserId,
      referralLink
    ]
  );

  return result.rows[0] || null;
}
module.exports = {
  findUserById,
  findOpportunityByPosition,
  findUserOpportunity,
  findRootUser,
  saveUserOpportunityLink
};