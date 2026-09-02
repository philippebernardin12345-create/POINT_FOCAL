const db = require("../config/db");

function runQuery(client, text, params = []) {
  return db.query(text, params, client);
}

async function setRootUser(rootUserId, options = {}) {
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    const result = await runQuery(
      client,
      `
      UPDATE v106_runtime_state
      SET
        root_user_id = $1,
        updated_at = NOW()
      WHERE singleton_id = true
      RETURNING
        phase,
        leader_count,
        leader_threshold,
        root_user_id
      `,
      [rootUserId]
    );

    return result.rows[0] || null;
  });
}

async function resolveRootUser(options = {}) {
  const result = await runQuery(
    options.client,
    `
    SELECT
      state.root_user_id,
      users.*
    FROM v106_runtime_state state
    LEFT JOIN users
      ON users.id = state.root_user_id
    WHERE state.singleton_id = true
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function getRuntimeState(options = {}) {
  const result = await runQuery(
    options.client,
    `
    SELECT
      phase,
      leader_count,
      leader_threshold,
      root_user_id,
      updated_at
    FROM v106_runtime_state
    WHERE singleton_id = true
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function getGlobalSponsorshipByChild(
  childUserId,
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    SELECT
      sponsor_user_id,
      child_user_id,
      slot_no,
      created_at
    FROM v106_global_sponsorships
    WHERE child_user_id = $1
    LIMIT 1
    `,
    [childUserId]
  );

  return result.rows[0] || null;
}

async function assignGlobalSponsor(
  sponsorUserId,
  childUserId,
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    SELECT
      sponsor_user_id,
      child_user_id,
      slot_no,
      created_at
    FROM v106_assign_global_sponsor($1, $2)
    `,
    [
      sponsorUserId,
      childUserId
    ]
  );

  return result.rows[0] || null;
}

async function findNextGlobalSponsor(options = {}) {
  const rootUser = await resolveRootUser(options);

  if (!rootUser?.id) {
    throw new Error("Aucun Root V10.6 configuré.");
  }

  const result = await runQuery(
    options.client,
    `
    WITH candidate AS (
      SELECT
        u.id,
        u.email,
        u.created_at,
        COALESCE(children.total_children, 0) AS total_children
      FROM users u
      CROSS JOIN (
        SELECT root_user_id
        FROM v106_runtime_state
        WHERE singleton_id = true
      ) state
      LEFT JOIN (
        SELECT
          sponsor_user_id,
          COUNT(*)::int AS total_children
        FROM v106_global_sponsorships
        GROUP BY sponsor_user_id
      ) children
        ON children.sponsor_user_id = u.id
      WHERE u.email_confirmed = true
        AND u.status = 'active'
        AND (
          u.id = state.root_user_id
          OR EXISTS (
            SELECT 1
            FROM v106_global_sponsorships tree
            WHERE tree.child_user_id = u.id
          )
        )
        AND COALESCE(children.total_children, 0) < 2
      ORDER BY u.created_at ASC, u.id ASC
      FOR UPDATE OF u SKIP LOCKED
      LIMIT 1
    )
    SELECT *
    FROM candidate
    `,
    []
  );

  return result.rows[0] || null;
}

async function assignNextGlobalSponsor(
  childUserId,
  options = {}
) {
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    const existing = await getGlobalSponsorshipByChild(
      childUserId,
      { client }
    );

    if (existing) {
      return existing;
    }

    const sponsor = await findNextGlobalSponsor({ client });

    if (!sponsor?.id) {
      throw new Error("Aucun sponsor global disponible.");
    }

    return assignGlobalSponsor(
      sponsor.id,
      childUserId,
      { client }
    );
  });
}

async function transitionPhaseToNormalOperation(options = {}) {
  const result = await runQuery(
    options.client,
    `
    SELECT
      phase,
      leader_count,
      leader_threshold,
      root_user_id,
      transitioned
    FROM v106_transition_phase_to_normal_operation()
    `
  );

  return result.rows[0] || null;
}

module.exports = {
  assignGlobalSponsor,
  assignNextGlobalSponsor,
  findNextGlobalSponsor,
  getGlobalSponsorshipByChild,
  getRuntimeState,
  resolveRootUser,
  setRootUser,
  transitionPhaseToNormalOperation
};
