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
    ORDER BY priority ASC, created_at ASC
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
    ORDER BY priority ASC, created_at ASC
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
 * Crée une nouvelle opportunité
 */
async function create(data) {
  const result = await query(
    `
    INSERT INTO opportunities (
      name,
      slug,
      description,
      status,
      is_available,
      priority,
      is_entry,
      generates_link,
      requires_provision,
      provision_amount,
      provision_message,
      registration_url,
      depends_on,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    RETURNING *
    `,
    [
      data.name,
      data.slug,
      data.description || null,
      data.status || "draft",
      data.isAvailable !== false,
      data.priority || 1,
      data.isEntry || false,
      data.canGeneratePointFocalLink || false,
      data.requiresProvision || false,
      data.provisionAmount || null,
      data.provisionMessage || null,
      data.registrationUrl || null,
      data.dependsOn || null
    ]
  );

  return result.rows[0];
}

/**
 * Met à jour une opportunité
 */
async function update(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }

  if (data.slug !== undefined) {
    fields.push(`slug = $${paramIndex++}`);
    values.push(data.slug);
  }

  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }

  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }

  if (data.isAvailable !== undefined) {
    fields.push(`is_available = $${paramIndex++}`);
    values.push(data.isAvailable);
  }

  if (data.priority !== undefined) {
    fields.push(`priority = $${paramIndex++}`);
    values.push(data.priority);
  }

  if (data.isEntry !== undefined) {
    fields.push(`is_entry = $${paramIndex++}`);
    values.push(data.isEntry);
  }

  if (data.canGeneratePointFocalLink !== undefined) {
    fields.push(`generates_link = $${paramIndex++}`);
    values.push(data.canGeneratePointFocalLink);
  }

  if (data.requiresProvision !== undefined) {
    fields.push(`requires_provision = $${paramIndex++}`);
    values.push(data.requiresProvision);
  }

  if (data.provisionAmount !== undefined) {
    fields.push(`provision_amount = $${paramIndex++}`);
    values.push(data.provisionAmount);
  }

  if (data.provisionMessage !== undefined) {
    fields.push(`provision_message = $${paramIndex++}`);
    values.push(data.provisionMessage);
  }

  if (data.registrationUrl !== undefined) {
    fields.push(`registration_url = $${paramIndex++}`);
    values.push(data.registrationUrl);
  }

  if (data.dependsOn !== undefined) {
    fields.push(`depends_on = $${paramIndex++}`);
    values.push(data.dependsOn);
  }

  if (fields.length === 0) {
    throw new Error("Aucune donnée à mettre à jour");
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `
    UPDATE opportunities
    SET ${fields.join(", ")}
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
  findById,
  findBySlug,
  create,
  update,
  remove
};