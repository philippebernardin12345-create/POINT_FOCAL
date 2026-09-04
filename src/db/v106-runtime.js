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
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    const sponsorResult = await runQuery(
      client,
      `
      SELECT id
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [sponsorUserId]
    );

    if (sponsorResult.rowCount === 0) {
      throw new Error("V106_SPONSOR_NOT_FOUND");
    }

    const childResult = await runQuery(
      client,
      `
      SELECT id
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [childUserId]
    );

    if (childResult.rowCount === 0) {
      throw new Error("V106_CHILD_NOT_FOUND");
    }

    if (sponsorUserId === childUserId) {
      throw new Error("V106_SELF_SPONSORING_FORBIDDEN");
    }

    const existingChild = await runQuery(
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

    if (existingChild.rowCount > 0) {
      const current = existingChild.rows[0];
      if (current.sponsor_user_id === sponsorUserId) {
        return current;
      }
      throw new Error("V106_CHILD_ALREADY_ASSIGNED");
    }

    try {
      const inserted = await runQuery(
        client,
        `
        WITH RECURSIVE bfs AS (
          SELECT
            users.id AS candidate_parent_id,
            0 AS depth,
            ARRAY[users.id::text] AS path_ids
          FROM users
          WHERE users.id = $1

          UNION ALL

          SELECT
            sponsorships.child_user_id AS candidate_parent_id,
            bfs.depth + 1 AS depth,
            bfs.path_ids || sponsorships.child_user_id::text AS path_ids
          FROM bfs
          JOIN v106_global_sponsorships sponsorships
            ON sponsorships.sponsor_user_id = bfs.candidate_parent_id
          WHERE NOT (sponsorships.child_user_id::text = ANY (bfs.path_ids))
        ),
        lock_candidate_parent AS (
          SELECT
            ordered_bfs.candidate_parent_id AS sponsor_user_id,
            free_slot.slot_no AS slot_no
          FROM (
            SELECT
              bfs.candidate_parent_id,
              bfs.depth,
              bfs.path_ids
            FROM bfs
            ORDER BY bfs.depth ASC, bfs.path_ids ASC
          ) AS ordered_bfs
          JOIN users candidate_parent
            ON candidate_parent.id = ordered_bfs.candidate_parent_id
          CROSS JOIN LATERAL (
            SELECT slot.slot_no
            FROM generate_series(1, 2) AS slot(slot_no)
            WHERE NOT EXISTS (
              SELECT 1
              FROM v106_global_sponsorships existing
              WHERE existing.sponsor_user_id = ordered_bfs.candidate_parent_id
                AND existing.slot_no = slot.slot_no
            )
            ORDER BY slot.slot_no ASC
            LIMIT 1
          ) AS free_slot
          ORDER BY ordered_bfs.depth ASC, ordered_bfs.path_ids ASC
          LIMIT 1
          FOR UPDATE OF candidate_parent
        )
        INSERT INTO v106_global_sponsorships (
          sponsor_user_id,
          child_user_id,
          slot_no
        )
        SELECT
          lock_candidate_parent.sponsor_user_id,
          $2,
          lock_candidate_parent.slot_no
        FROM lock_candidate_parent
        RETURNING
          sponsor_user_id,
          child_user_id,
          slot_no,
          created_at
        `,
        [sponsorUserId, childUserId]
      );

      if (inserted.rowCount === 0) {
        throw new Error("V106_SPONSOR_SLOTS_EXHAUSTED");
      }

      return inserted.rows[0];
    } catch (error) {
      if (error && error.code === "23505") {
        const afterConflict = await runQuery(
          client,
          `
          SELECT
            sponsor_user_id,
            child_user_id,
            slot_no,
            created_at
          FROM v106_global_sponsorships
          WHERE child_user_id = $1
          `,
          [childUserId]
        );

        if (afterConflict.rowCount > 0 && afterConflict.rows[0].sponsor_user_id === sponsorUserId) {
          return afterConflict.rows[0];
        }

        throw new Error("V106_GLOBAL_SPONSORSHIP_CONFLICT");
      }

      throw error;
    }
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
