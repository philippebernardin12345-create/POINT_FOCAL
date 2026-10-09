/**
 * POINT FOCAL V10.4 - Repository Opportunités
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 37
 */

const { query } = require("../../config/db");

/**
 * Récupère toutes les opportunités
 */
async function findAll() {
  const result = await query(
    `
    SELECT *
    FROM opportunities
    ORDER BY position ASC, created_at ASC
    `
  );

  return result.rows;
}

/**
 * Récupère toutes les opportunités actives
 */
async function findAllActive() {
  const result = await query(
    `
    SELECT *
    FROM opportunities
    WHERE UPPER(status) = 'ACTIVE'
    ORDER BY position ASC, created_at ASC
    `
  );

  return result.rows;
}

/**
 * Récupère une opportunité par son ID
 */
async function findById(id) {
  const result = await query(
    `
    SELECT *
    FROM opportunities
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Récupère une opportunité par son slug
 */
async function findBySlug(slug) {
  const result = await query(
    `
    SELECT *
    FROM opportunities
    WHERE slug = $1
    `,
    [slug]
  );

  return result.rows[0] || null;
}


/**
 * Returns active opportunities with this user's membership state.
 * Only columns present in the production opportunity schema are selected.
 */
async function findActiveForUser(userId) {
  const result = await query(
    `
    SELECT
      o.id,
      o.name,
      o.slug,
      o.status,
      o.position,
      o.priority,
      o.is_entry,
      o.generates_link,
      o.requires_user_link,
      o.rollup_enabled,
      CASE
        WHEN o.slug IN ('victory-automatic', 'victory-world')
          AND NOT (
            COALESCE(u.link_active, false) = true
            AND NULLIF(BTRIM(u.invitation_code), '') IS NOT NULL
            AND NULLIF(BTRIM(u.victory_personal_link), '') IS NOT NULL
          )
          THEN NULL
        ELSE uo.status
      END AS user_opportunity_status,
      CASE
        WHEN o.slug IN ('victory-automatic', 'victory-world')
          AND NOT (
            COALESCE(u.link_active, false) = true
            AND NULLIF(BTRIM(u.invitation_code), '') IS NOT NULL
            AND NULLIF(BTRIM(u.victory_personal_link), '') IS NOT NULL
          )
          THEN NULL
        ELSE uo.joined_at
      END AS user_joined_at
    FROM opportunities o
    LEFT JOIN users u
      ON u.id = $1
    LEFT JOIN user_opportunities uo
      ON uo.opportunity_id = o.id
     AND uo.user_id = $1
    WHERE UPPER(o.status) = 'ACTIVE'
    ORDER BY o.position ASC NULLS LAST, o.priority ASC, o.id ASC
    `,
    [userId]
  );

  return result.rows;
}

/**
 * Les disponibilités sont représentées par status dans le schéma réel.
 * Les dépendances et les champs de provision ne sont pas persistés par
 * opportunities; ils ne doivent donc pas être envoyés en SQL.
 */
const UNSUPPORTED_FIELDS = [
  "dependsOn",
  "requiresProvision",
  "provisionAmount",
  "provisionMessage",
  "registrationUrl"
];

function assertSupportedFields(data = {}) {
  const unsupported = UNSUPPORTED_FIELDS.filter((field) => data[field] !== undefined);
  if (unsupported.length) {
    throw new Error(`Champs opportunité non pris en charge par le schéma PostgreSQL : ${unsupported.join(", ")}`);
  }
}

function opportunityStatus(data = {}, fallback = "draft") {
  if (data.status !== undefined) return data.status;
  if (data.isAvailable !== undefined) return data.isAvailable ? "active" : "inactive";
  return fallback;
}

/**
 * Crée une opportunité avec les colonnes présentes dans public.opportunities.
 */
async function create(data) {
  assertSupportedFields(data);

  const fields = [];
  const values = [];
  const add = (column, value) => {
    if (value !== undefined) {
      fields.push(column);
      values.push(value);
    }
  };

  add("name", data.name);
  add("slug", data.slug);
  add("description", data.description ?? null);
  add("status", opportunityStatus(data));
  add("position", data.position);
  add("priority", data.priority);
  add("is_entry", data.isEntry);
  add("generates_link", data.canGeneratePointFocalLink);
  add("requires_user_link", data.requiresUserLink);
  add("entry_mode", data.entryMode);
  add("entry_url", data.entryUrl);
  add("opportunity_url", data.opportunityUrl);
  add("root_sponsor_link", data.rootSponsorLink);
  add("root_user_id", data.rootUserId);
  add("max_direct_referrals", data.maxDirectReferrals);
  add("rollup_enabled", data.rollupEnabled);
  add("type", data.type);
  add("logo_url", data.logoUrl);

  const placeholders = values.map((_, index) => `$${index + 1}`);
  const result = await query(
    `
    INSERT INTO opportunities (
      ${fields.join(", ")},
      created_at,
      updated_at
    )
    VALUES (${placeholders.join(", ")}, NOW(), NOW())
    RETURNING *
    `,
    values
  );

  return result.rows[0];
}

/**
 * Met à jour une opportunité avec les colonnes présentes dans public.opportunities.
 */
async function update(id, data) {
  assertSupportedFields(data);

  const assignments = [];
  const values = [];
  let paramIndex = 1;
  const add = (column, value) => {
    if (value !== undefined) {
      assignments.push(`${column} = $${paramIndex++}`);
      values.push(value);
    }
  };

  add("name", data.name);
  add("slug", data.slug);
  add("description", data.description);
  add("status", data.status !== undefined ? data.status :
    data.isAvailable !== undefined ? opportunityStatus(data, undefined) : undefined);
  add("position", data.position);
  add("priority", data.priority);
  add("is_entry", data.isEntry);
  add("generates_link", data.canGeneratePointFocalLink);
  add("requires_user_link", data.requiresUserLink);
  add("entry_mode", data.entryMode);
  add("entry_url", data.entryUrl);
  add("opportunity_url", data.opportunityUrl);
  add("root_sponsor_link", data.rootSponsorLink);
  add("root_user_id", data.rootUserId);
  add("max_direct_referrals", data.maxDirectReferrals);
  add("rollup_enabled", data.rollupEnabled);
  add("type", data.type);
  add("logo_url", data.logoUrl);

  if (assignments.length === 0) {
    throw new Error("Aucune donnée à mettre à jour");
  }

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await query(
    `
    UPDATE opportunities
    SET ${assignments.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

/**
 * Supprime une opportunité
 */
async function remove(id) {
  const result = await query(
    `
    DELETE FROM opportunities
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findAll,
  findAllActive,
  findActiveForUser,
  findById,
  findBySlug,
  create,
  update,
  remove
};