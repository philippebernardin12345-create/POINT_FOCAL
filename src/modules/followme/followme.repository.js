const db = require("../../config/db");

function runQuery(client, text, params = []) {
  return db.query(text, params, client);
}

async function findUserById(userId, options = {}) {
  const result = await runQuery(
    options.client,
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

async function findUserOpportunity(
  userId,
  opportunityId,
  options = {}
) {
  const result = await runQuery(
    options.client,
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

async function findUserByLink(
  referralLink,
  opportunityId,
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    SELECT user_id
    FROM user_opportunities
    WHERE referral_link = $1
      AND opportunity_id = $2
      AND status = 'active'
    LIMIT 1
    `,
    [referralLink, opportunityId]
  );

  return result.rows[0] || null;
}

async function upsertUserOpportunity(
  {
    userId,
    opportunityId,
    referralLink,
    targetAddress = null,
    paymentHash = null,
    sponsorUserId = null,
    status = "active"
  },
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    INSERT INTO user_opportunities (
      user_id,
      opportunity_id,
      referral_link,
      target_address,
      payment_hash,
      sponsor_user_id,
      status,
      joined_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    ON CONFLICT (user_id, opportunity_id)
    DO UPDATE SET
      referral_link = EXCLUDED.referral_link,
      target_address = EXCLUDED.target_address,
      payment_hash = EXCLUDED.payment_hash,
      sponsor_user_id = EXCLUDED.sponsor_user_id,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *
    `,
    [
      userId,
      opportunityId,
      referralLink,
      targetAddress,
      paymentHash,
      sponsorUserId,
      status
    ]
  );

  return result.rows[0] || null;
}

async function getUserLinks(userId, options = {}) {
  const result = await runQuery(
    options.client,
    `
    SELECT
      uo.*,
      o.name as opportunity_name,
      o.slug as opportunity_slug
    FROM user_opportunities uo
    LEFT JOIN opportunities o ON o.id = uo.opportunity_id
    WHERE uo.user_id = $1
      AND uo.status = 'active'
    ORDER BY uo.joined_at ASC, uo.id ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getAvailableLink(
  opportunityId,
  excludeUserId = null,
  options = {}
) {
  const params = [opportunityId];
  let text = `
    SELECT
      uo.*,
      u.email,
      u.whatsapp
    FROM user_opportunities uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.opportunity_id = $1
      AND uo.status = 'active'
  `;

  if (excludeUserId) {
    params.push(excludeUserId);
    text += ` AND uo.user_id <> $${params.length}`;
  }

  text += `
    ORDER BY uo.joined_at ASC, uo.user_id ASC
    LIMIT 1
  `;

  const result = await runQuery(
    options.client,
    text,
    params
  );

  return result.rows[0] || null;
}

async function countActiveLinks(
  opportunityId,
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    SELECT COUNT(*)::int AS count
    FROM user_opportunities
    WHERE opportunity_id = $1
      AND status = 'active'
    `,
    [opportunityId]
  );

  return result.rows[0]?.count || 0;
}

async function findRollupLog(
  {
    userId,
    opportunityId,
    originalSponsorId = null,
    rollupParentId,
    reason = "sponsor_not_in_opportunity"
  },
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    SELECT *
    FROM rollup_logs
    WHERE user_id = $1
      AND opportunity_id = $2
      AND reason = $3
      AND rollup_parent_id = $4
      AND (
        original_sponsor_id = $5
        OR (
          original_sponsor_id IS NULL
          AND $5 IS NULL
        )
      )
    ORDER BY created_at ASC
    LIMIT 1
    `,
    [
      userId,
      opportunityId,
      reason,
      rollupParentId,
      originalSponsorId
    ]
  );

  return result.rows[0] || null;
}

async function createRollupLog(
  {
    userId,
    opportunityId,
    originalSponsorId = null,
    rollupParentId,
    reason = "sponsor_not_in_opportunity"
  },
  options = {}
) {
  const existing = await findRollupLog(
    {
      userId,
      opportunityId,
      originalSponsorId,
      rollupParentId,
      reason
    },
    options
  );

  if (existing) {
    return existing;
  }

  const result = await runQuery(
    options.client,
    `
    INSERT INTO rollup_logs (
      user_id,
      opportunity_id,
      original_sponsor_id,
      rollup_parent_id,
      reason,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *
    `,
    [
      userId,
      opportunityId,
      originalSponsorId,
      rollupParentId,
      reason
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  countActiveLinks,
  createRollupLog,
  findRollupLog,
  findUserById,
  findUserByLink,
  findUserOpportunity,
  getAvailableLink,
  getUserLinks,
  upsertUserOpportunity
};
