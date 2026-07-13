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
}async function saveSeries2Code(userId, code) {
  const result = await db.query(
    `
    UPDATE users
    SET invitation_code_series_2 = $2
    WHERE id = $1
      AND invitation_code_series_2 IS NULL
    RETURNING
      id,
      invitation_code_series_2
    `,
    [userId, code]
  );

  return result.rows[0] || null;
}

async function saveSeries3Code(userId, code) {
  const result = await db.query(
    `
    UPDATE users
    SET invitation_code_series_3 = $2
    WHERE id = $1
      AND invitation_code_series_3 IS NULL
    RETURNING
      id,
      invitation_code_series_3
    `,
    [userId, code]
  );

  return result.rows[0] || null;
}async function findPreviousOpportunityCompleted(
  userId,
  position
) {
  if (position <= 1) {
    return true;
  }

  const result = await db.query(
    `
    SELECT uo.id
    FROM user_opportunities uo
    INNER JOIN opportunities o
      ON o.id = uo.opportunity_id
    WHERE uo.user_id = $1
      AND o.position = $2
      AND uo.status = 'completed'
    LIMIT 1
    `,
    [
      userId,
      Number(position) - 1
    ]
  );

  return result.rows.length > 0;
}
module.exports = {
  findUserById,
  findOpportunityByPosition,
  findUserOpportunity,
  findRootUser,
  saveUserOpportunityLink,
  saveSeries2Code,
  saveSeries3Code,
  findPreviousOpportunityCompleted
};