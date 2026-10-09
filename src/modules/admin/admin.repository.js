const db = require("../../config/db");

// ============================================================
// STATISTIQUES DU DASHBOARD
// ============================================================

async function getDashboardStats() {
  const usersResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    `
  );

  const leadersResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE is_leader = true
    `
  );

  const paymentsResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM payments
    `
  );

  const opportunitiesResult = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM opportunities
    `
  );

  const usersByCountryResult = await db.query(
    `
    SELECT
      COALESCE(NULLIF(UPPER(TRIM(country_code)), ''), 'UN') AS country_code,
      COUNT(*)::int AS users,
      COUNT(*) FILTER (WHERE is_leader = true)::int AS leaders
    FROM users
    GROUP BY 1
    ORDER BY users DESC, country_code ASC
    `
  );

  const leadersPerformanceResult = await db.query(
    `
    SELECT
      leader.id,
      leader.email,
      leader.country_code,
      COUNT(member.id)::int AS direct_members,
      COUNT(member.id) FILTER (WHERE LOWER(COALESCE(member.status, '')) = 'active')::int AS active_direct_members
    FROM users AS leader
    LEFT JOIN users AS member ON member.sponsor_id = leader.id
    WHERE leader.is_leader = true
    GROUP BY leader.id, leader.email, leader.country_code
    ORDER BY direct_members DESC, leader.created_at ASC
    `
  );

  return {
    users:
      usersResult.rows[0]?.total || 0,

    leaders:
      leadersResult.rows[0]?.total || 0,

    payments:
      paymentsResult.rows[0]?.total || 0,

    opportunities:
      opportunitiesResult.rows[0]?.total || 0,
    usersByCountry: usersByCountryResult.rows,
    leadersPerformance: leadersPerformanceResult.rows
  };
}

// ============================================================
// LISTE DES UTILISATEURS
// ============================================================

async function getUsers() {
  const result = await db.query(
    `
    SELECT
      member.id,
      member.email,
      member.whatsapp,
      member.country_code,
      member.sponsor_id,
      sponsor.email AS sponsor_email,
      member.is_leader,
      member.created_at
    FROM users AS member
    LEFT JOIN users AS sponsor ON sponsor.id = member.sponsor_id
    ORDER BY member.id DESC
    `
  );

  return result.rows;
}

// ============================================================
// RÉCUPÉRER LES OPPORTUNITÉS
// ============================================================

async function getOpportunities() {
  const result = await db.query(
    `
    SELECT
      id,
      name,
      description,
      opportunity_url,
      status,
      prelaunch_enabled,
      public_open,
      default_language,
      created_at
    FROM campaigns
    ORDER BY id DESC
    `
  );

  return result.rows;
}

// ============================================================
// AJOUTER UNE OPPORTUNITÉ
// ============================================================

async function createOpportunity(data) {
  const {
    name,
    description,
    opportunityUrl,
    status,
    prelaunchEnabled,
    publicOpen,
    defaultLanguage
  } = data;

  const result = await db.query(
    `
    INSERT INTO campaigns (
      name,
      description,
      opportunity_url,
      status,
      prelaunch_enabled,
      public_open,
      default_language
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7
    )
    RETURNING
      id,
      name,
      description,
      opportunity_url,
      status,
      prelaunch_enabled,
      public_open,
      default_language,
      created_at
    `,
    [
      name,
      description,
      opportunityUrl,
      status,
      prelaunchEnabled,
      publicOpen,
      defaultLanguage
    ]
  );

  return result.rows[0];
}

// ============================================================
// MODIFIER UNE OPPORTUNITÉ
// ============================================================

async function updateOpportunity(
  id,
  data
) {
  const {
    name,
    description,
    opportunityUrl,
    status,
    prelaunchEnabled,
    publicOpen,
    defaultLanguage
  } = data;

  const result = await db.query(
    `
    UPDATE campaigns
    SET
      name = $1,
      description = $2,
      opportunity_url = $3,
      status = $4,
      prelaunch_enabled = $5,
      public_open = $6,
      default_language = $7
    WHERE id = $8
    RETURNING
      id,
      name,
      description,
      opportunity_url,
      status,
      prelaunch_enabled,
      public_open,
      default_language,
      created_at
    `,
    [
      name,
      description,
      opportunityUrl,
      status,
      prelaunchEnabled,
      publicOpen,
      defaultLanguage,
      id
    ]
  );

  return result.rows[0];
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getDashboardStats,
  getUsers,
  getOpportunities,
  createOpportunity,
  updateOpportunity
};