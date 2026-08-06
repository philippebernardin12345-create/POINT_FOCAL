
const db = require("../../config/db");

async function findAllActive() {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE active = true
    ORDER BY position ASC
    `
  );

  return result.rows;
}

async function findAll() {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    ORDER BY position ASC
    `
  );

  return result.rows;
}

async function findById(id) {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
}
async function findOpportunityBySlug(slug) {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function findAssignmentByUser(
  userId,
  opportunityId
) {
  const result = await db.query(
    `
    SELECT *
    FROM opportunity_assignments
    WHERE user_id = $1
      AND opportunity_id = $2
    LIMIT 1
    `,
    [userId, opportunityId]
  );

  return result.rows[0] || null;
}

async function findAssignmentByPersonalLink(
  opportunityId,
  personalLink
) {
  const result = await db.query(
    `
    SELECT *
    FROM opportunity_assignments
    WHERE opportunity_id = $1
      AND personal_link = $2
    LIMIT 1
    `,
    [opportunityId, personalLink]
  );

  return result.rows[0] || null;
}

async function createAssignment({
  userId,
  opportunityId,
  assignedSponsorLink,
  personalLink,
  realParentLink,
  assignmentSource = "follow_me"
}) {
  const result = await db.query(
    `
    INSERT INTO opportunity_assignments (
      user_id,
      opportunity_id,
      assigned_sponsor_link,
      personal_link,
      real_parent_link,
      assignment_source
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      userId,
      opportunityId,
      assignedSponsorLink,
      personalLink,
      realParentLink,
      assignmentSource
    ]
  );

  return result.rows[0];
}

async function getActiveEntryOpportunity() {
  const result = await db.query(
    `
    SELECT *
    FROM opportunities
    WHERE status = 'active'
      AND is_entry = true
    ORDER BY priority ASC
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}
module.exports = {
  findAllActive,
  findAll,
  findById,

  findOpportunityBySlug,
  findAssignmentByUser,
  findAssignmentByPersonalLink,
  createAssignment,

  getActiveEntryOpportunity
};
