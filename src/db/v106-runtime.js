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
  const client = options.client;
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (runner) => {
    const stateResult = await runQuery(
      runner,
      `
      SELECT root_user_id
      FROM v106_runtime_state
      WHERE singleton_id = true
      FOR UPDATE
      `,
      []
    );

    const rootUserId = stateResult.rows[0]?.root_user_id;

    if (!rootUserId) {
      return null;
    }

    const rootResult = await runQuery(
      runner,
      `
      SELECT *
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [rootUserId]
    );

    return rootResult.rows[0] || null;
  }, client);
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
  const execute = options.client
    ? (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    await runQuery(
      client,
      `
      SELECT singleton_id
      FROM v106_runtime_state
      WHERE singleton_id = true
      FOR UPDATE
      `
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await runQuery(
        client,
        `
        WITH RECURSIVE bfs AS (
          SELECT
            $1::uuid AS user_id,
            0 AS depth,
            ARRAY[]::integer[] AS slot_path,
            ARRAY[$1::uuid] AS visited

          UNION ALL

          SELECT
            gs.child_user_id,
            bfs.depth + 1,
            bfs.slot_path || gs.slot_no,
            bfs.visited || gs.child_user_id
          FROM bfs
          JOIN v106_global_sponsorships gs
            ON gs.sponsor_user_id = bfs.user_id
          WHERE NOT (gs.child_user_id = ANY(bfs.visited))
        ),
        existing AS (
          SELECT
            sponsor_user_id,
            child_user_id,
            slot_no,
            created_at
          FROM v106_global_sponsorships
          WHERE child_user_id = $2::uuid
        ),
        candidate AS (
          SELECT
            bfs.user_id AS sponsor_user_id,
            slots.slot_no
          FROM bfs
          CROSS JOIN (VALUES (1),(2)) AS slots(slot_no)
          LEFT JOIN v106_global_sponsorships occupied
            ON occupied.sponsor_user_id = bfs.user_id
           AND occupied.slot_no = slots.slot_no
          WHERE occupied.child_user_id IS NULL
          ORDER BY bfs.depth, bfs.slot_path, slots.slot_no
          LIMIT 1
        ),
        locked_candidate AS (
          SELECT
            c.sponsor_user_id,
            c.slot_no
          FROM candidate c
          JOIN users u
            ON u.id = c.sponsor_user_id
          FOR UPDATE OF u
        ),
        inserted AS (
          INSERT INTO v106_global_sponsorships
            (sponsor_user_id, child_user_id, slot_no)
          SELECT
            lc.sponsor_user_id,
            $2::uuid,
            lc.slot_no
          FROM locked_candidate lc
          WHERE NOT EXISTS (
            SELECT 1 FROM existing
          )
          RETURNING
            sponsor_user_id,
            child_user_id,
            slot_no,
            created_at
        )
        SELECT *
        FROM inserted

        UNION ALL

        SELECT
          e.sponsor_user_id,
          e.child_user_id,
          e.slot_no,
          e.created_at
        FROM existing e
        WHERE NOT EXISTS (
          SELECT 1 FROM inserted
        )
        AND EXISTS (
          SELECT 1
          FROM bfs
          WHERE bfs.user_id = e.sponsor_user_id
        )
        LIMIT 1
        `,
        [sponsorUserId, childUserId]
      );

      if (result.rows[0]) {
        return result.rows[0];
      }
    }

    const error = new Error(
      'Unable to assign global sponsor after concurrent placement attempts'
    );
    error.code = 'V106_GLOBAL_SPONSORSHIP_CONFLICT';
    throw error;
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
  getRuntimeState,
  resolveRootUser,
  setRootUser,
  transitionPhaseToNormalOperation
};
