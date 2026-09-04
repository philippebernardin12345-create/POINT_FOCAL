const db = require("../config/db");

function runQuery(client, text, params) {
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
  const lockClause = options.forUpdate
    ? "FOR UPDATE"
    : "";

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
    ${lockClause}
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

async function assignGlobalSponsorBfs(
  subtreeRootUserId,
  childUserId,
  options = {}
) {
  const client = options.client;

  if (!client) {
    throw new Error("V106_ASSIGN_BFS_REQUIRES_TRANSACTION_CLIENT");
  }

  if (!subtreeRootUserId) {
    throw new Error("V106_SUBTREE_ROOT_REQUIRED");
  }

  await runQuery(
    client,
    `
    SELECT 1
    FROM users
    WHERE id = $1
    FOR UPDATE
    `,
    [subtreeRootUserId]
  );

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const existing = await runQuery(
      client,
      `
      SELECT
        sponsor_user_id,
        child_user_id,
        slot_no,
        created_at
      FROM v106_global_sponsorships
      WHERE child_user_id = $1
      FOR UPDATE
      `,
      [childUserId]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const candidateResult = await runQuery(
      client,
      `
      WITH RECURSIVE bfs AS (
        SELECT
          u.id AS sponsor_user_id,
          ARRAY[]::smallint[] AS path
        FROM users u
        WHERE u.id = $1
        UNION ALL
        SELECT
          edge.child_user_id AS sponsor_user_id,
          bfs.path || edge.slot_no
        FROM bfs
        JOIN v106_global_sponsorships edge
          ON edge.sponsor_user_id = bfs.sponsor_user_id
      ),
      slots AS (
        SELECT
          bfs.sponsor_user_id,
          bfs.path,
          slot.slot_no
        FROM bfs
        CROSS JOIN (VALUES (1::smallint), (2::smallint)) AS slot(slot_no)
        WHERE NOT EXISTS (
          SELECT 1
          FROM v106_global_sponsorships taken
          WHERE taken.sponsor_user_id = bfs.sponsor_user_id
            AND taken.slot_no = slot.slot_no
        )
      )
      SELECT
        sponsor_user_id,
        slot_no
      FROM slots
      ORDER BY
        cardinality(path) ASC,
        path ASC,
        slot_no ASC
      LIMIT 1
      `,
      [subtreeRootUserId]
    );

    const candidate = candidateResult.rows[0];

    if (!candidate) {
      throw new Error("V106_GLOBAL_TREE_SLOT_NOT_FOUND");
    }

    await runQuery(
      client,
      `
      SELECT 1
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [candidate.sponsor_user_id]
    );

    const inserted = await runQuery(
      client,
      `
      INSERT INTO v106_global_sponsorships (
        sponsor_user_id,
        child_user_id,
        slot_no
      )
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      RETURNING
        sponsor_user_id,
        child_user_id,
        slot_no,
        created_at
      `,
      [
        candidate.sponsor_user_id,
        childUserId,
        candidate.slot_no
      ]
    );

    if (inserted.rows[0]) {
      return inserted.rows[0];
    }

    const assignedAfterConflict = await runQuery(
      client,
      `
      SELECT
        sponsor_user_id,
        child_user_id,
        slot_no,
        created_at
      FROM v106_global_sponsorships
      WHERE child_user_id = $1
      FOR UPDATE
      `,
      [childUserId]
    );

    if (assignedAfterConflict.rows[0]) {
      return assignedAfterConflict.rows[0];
    }
  }

  throw new Error("V106_GLOBAL_ASSIGNMENT_RETRY_EXHAUSTED");
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
  assignGlobalSponsorBfs,
  getRuntimeState,
  resolveRootUser,
  setRootUser,
  transitionPhaseToNormalOperation
};
