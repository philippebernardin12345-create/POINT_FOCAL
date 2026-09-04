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

async function assignGlobalSponsor(
  sponsorUserId,
  childUserId,
  options = {}
) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runQuery(
      options.client,
      `
    WITH RECURSIVE
    lock_sponsor AS (
      SELECT id
      FROM users
      WHERE id = $1
      FOR UPDATE
    ),
    lock_child AS (
      SELECT id
      FROM users
      WHERE id = $2
      FOR UPDATE
    ),
    existing_child AS (
      SELECT
        gs.sponsor_user_id,
        gs.child_user_id,
        gs.slot_no,
        gs.created_at
      FROM v106_global_sponsorships AS gs
      WHERE gs.child_user_id = $2
      FOR UPDATE
    ),
    bfs AS (
      SELECT
        ls.id AS user_id,
        0 AS depth,
        ARRAY[]::smallint[] AS slot_path,
        ARRAY[ls.id] AS user_path
      FROM lock_sponsor AS ls

      UNION ALL

      SELECT
        gs.child_user_id AS user_id,
        bfs.depth + 1 AS depth,
        bfs.slot_path || gs.slot_no AS slot_path,
        bfs.user_path || gs.child_user_id AS user_path
      FROM bfs
      JOIN v106_global_sponsorships AS gs
        ON gs.sponsor_user_id = bfs.user_id
      WHERE NOT gs.child_user_id = ANY(bfs.user_path)
    ),
    candidate AS (
      SELECT
        bfs.user_id AS sponsor_user_id,
        CASE
          WHEN slot_1.child_user_id IS NULL THEN 1::smallint
          WHEN slot_2.child_user_id IS NULL THEN 2::smallint
          ELSE NULL::smallint
        END AS slot_no
      FROM bfs
      LEFT JOIN v106_global_sponsorships AS slot_1
        ON slot_1.sponsor_user_id = bfs.user_id
       AND slot_1.slot_no = 1
      LEFT JOIN v106_global_sponsorships AS slot_2
        ON slot_2.sponsor_user_id = bfs.user_id
       AND slot_2.slot_no = 2
      WHERE slot_1.child_user_id IS NULL
         OR slot_2.child_user_id IS NULL
      ORDER BY
        bfs.depth,
        bfs.slot_path,
        CASE
          WHEN slot_1.child_user_id IS NULL THEN 1
          ELSE 2
        END
      LIMIT 1
    ),
    lock_candidate_parent AS (
      SELECT users.id
      FROM users
      JOIN candidate
        ON candidate.sponsor_user_id = users.id
      FOR UPDATE
    ),
    existing_in_tree AS (
      SELECT
        existing_child.sponsor_user_id,
        existing_child.child_user_id,
        existing_child.slot_no,
        existing_child.created_at
      FROM existing_child
      JOIN bfs
        ON bfs.user_id = existing_child.sponsor_user_id
      LIMIT 1
    ),
    lock_existing_parent AS (
      SELECT users.id
      FROM users
      JOIN existing_in_tree
        ON existing_in_tree.sponsor_user_id = users.id
      FOR UPDATE
    ),
    inserted AS (
      INSERT INTO v106_global_sponsorships (
        sponsor_user_id,
        child_user_id,
        slot_no
      )
      SELECT
        candidate.sponsor_user_id,
        $2,
        candidate.slot_no
      FROM candidate
      WHERE EXISTS (SELECT 1 FROM lock_sponsor)
        AND EXISTS (SELECT 1 FROM lock_child)
        AND EXISTS (SELECT 1 FROM lock_candidate_parent)
        AND NOT EXISTS (SELECT 1 FROM existing_child)
        AND $1 <> $2
      ON CONFLICT DO NOTHING
      RETURNING
        sponsor_user_id,
        child_user_id,
        slot_no,
        created_at
    )
    SELECT
      final.status,
      final.error_code,
      final.sponsor_user_id,
      final.child_user_id,
      final.slot_no,
      final.created_at
    FROM (
      SELECT
        1 AS priority,
        'error'::text AS status,
        'V106_SPONSOR_NOT_FOUND'::text AS error_code,
        NULL AS sponsor_user_id,
        NULL AS child_user_id,
        NULL::smallint AS slot_no,
        NULL::timestamptz AS created_at
      WHERE NOT EXISTS (SELECT 1 FROM lock_sponsor)

      UNION ALL

      SELECT
        2 AS priority,
        'error'::text AS status,
        'V106_CHILD_NOT_FOUND'::text AS error_code,
        NULL,
        NULL,
        NULL::smallint,
        NULL::timestamptz
      WHERE NOT EXISTS (SELECT 1 FROM lock_child)

      UNION ALL

      SELECT
        3 AS priority,
        'error'::text AS status,
        'V106_SELF_SPONSORING_FORBIDDEN'::text AS error_code,
        NULL,
        NULL,
        NULL::smallint,
        NULL::timestamptz
      WHERE $1 = $2

      UNION ALL

      SELECT
        4 AS priority,
        'ok'::text AS status,
        NULL::text AS error_code,
        existing_in_tree.sponsor_user_id,
        existing_in_tree.child_user_id,
        existing_in_tree.slot_no,
        existing_in_tree.created_at
      FROM existing_in_tree
      WHERE EXISTS (SELECT 1 FROM lock_existing_parent)

      UNION ALL

      SELECT
        5 AS priority,
        'error'::text AS status,
        'V106_CHILD_ALREADY_ASSIGNED_TO_ANOTHER_PARENT'::text AS error_code,
        NULL,
        NULL,
        NULL::smallint,
        NULL::timestamptz
      WHERE EXISTS (SELECT 1 FROM existing_child)
        AND NOT EXISTS (SELECT 1 FROM existing_in_tree)

      UNION ALL

      SELECT
        6 AS priority,
        'error'::text AS status,
        'V106_GLOBAL_PLACEMENT_PARENT_NOT_FOUND'::text AS error_code,
        NULL,
        NULL,
        NULL::smallint,
        NULL::timestamptz
      WHERE NOT EXISTS (SELECT 1 FROM existing_child)
        AND NOT EXISTS (SELECT 1 FROM candidate)

      UNION ALL

      SELECT
        7 AS priority,
        'ok'::text AS status,
        NULL::text AS error_code,
        inserted.sponsor_user_id,
        inserted.child_user_id,
        inserted.slot_no,
        inserted.created_at
      FROM inserted

      UNION ALL

      SELECT
        8 AS priority,
        'error'::text AS status,
        'V106_GLOBAL_SPONSORSHIP_CONFLICT'::text AS error_code,
        NULL,
        NULL,
        NULL::smallint,
        NULL::timestamptz
      WHERE EXISTS (SELECT 1 FROM lock_sponsor)
        AND EXISTS (SELECT 1 FROM lock_child)
        AND $1 <> $2
        AND NOT EXISTS (SELECT 1 FROM existing_child)
        AND EXISTS (SELECT 1 FROM candidate)
        AND NOT EXISTS (SELECT 1 FROM inserted)
    ) AS final
    ORDER BY final.priority
    LIMIT 1
    `,
      [
        sponsorUserId,
        childUserId
      ]
    );

    const row = result.rows[0] || null;

    if (!row) {
      throw new Error("V106_GLOBAL_PLACEMENT_FAILED");
    }

    if (row.status === "error") {
      if (
        row.error_code === "V106_GLOBAL_SPONSORSHIP_CONFLICT"
        && attempt < maxAttempts
      ) {
        continue;
      }

      throw new Error(row.error_code || "V106_GLOBAL_PLACEMENT_FAILED");
    }

    return {
      sponsor_user_id: row.sponsor_user_id,
      child_user_id: row.child_user_id,
      slot_no: row.slot_no,
      created_at: row.created_at
    };
  }

  throw new Error("V106_GLOBAL_SPONSORSHIP_CONFLICT");
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
  getRuntimeState,
  resolveRootUser,
  setRootUser,
  transitionPhaseToNormalOperation
};
