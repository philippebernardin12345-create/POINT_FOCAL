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
  const forUpdateClause =
    options.forUpdate === true
      ? "FOR UPDATE OF state"
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
    ${forUpdateClause}
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

async function findFirstAvailableGlobalSponsorInSubtree(
  businessSponsorUserId,
  options = {}
) {
  const result = await runQuery(
    options.client,
    `
    WITH RECURSIVE subtree AS (
      SELECT
        $1 AS user_id,
        0 AS depth,
        ''::text AS bfs_path,
        ARRAY[$1] AS visited_user_ids

      UNION ALL

      SELECT
        gs.child_user_id,
        subtree.depth + 1,
        subtree.bfs_path || gs.slot_no::text,
        subtree.visited_user_ids || gs.child_user_id
      FROM subtree
      INNER JOIN v106_global_sponsorships gs
        ON gs.sponsor_user_id = subtree.user_id
      WHERE NOT (
        gs.child_user_id = ANY(subtree.visited_user_ids)
      )
    )
    SELECT
      subtree.user_id AS sponsor_user_id,
      CASE
        WHEN slot_1.child_user_id IS NULL THEN 1
        WHEN slot_2.child_user_id IS NULL THEN 2
        ELSE NULL
      END AS next_slot,
      subtree.depth,
      subtree.bfs_path
    FROM subtree
    LEFT JOIN v106_global_sponsorships slot_1
      ON slot_1.sponsor_user_id = subtree.user_id
     AND slot_1.slot_no = 1
    LEFT JOIN v106_global_sponsorships slot_2
      ON slot_2.sponsor_user_id = subtree.user_id
     AND slot_2.slot_no = 2
    WHERE slot_1.child_user_id IS NULL
       OR slot_2.child_user_id IS NULL
    ORDER BY
      subtree.depth ASC,
      subtree.bfs_path ASC
    LIMIT 1
    `
    ,
    [businessSponsorUserId]
  );

  return result.rows[0] || null;
}

function isRetryablePlacementError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");

  if (code === "23505") {
    return true;
  }

  return [
    "V106_SPONSOR_SLOTS_EXHAUSTED",
    "V106_GLOBAL_SPONSORSHIP_CONFLICT"
  ].some((token) => message.includes(token));
}

async function assignGlobalSponsorInSubtree(
  businessSponsorUserId,
  childUserId,
  options = {}
) {
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate =
      await findFirstAvailableGlobalSponsorInSubtree(
        businessSponsorUserId,
        options
      );

    if (!candidate?.sponsor_user_id) {
      throw new Error(
        "V106_GLOBAL_SUBTREE_FULL"
      );
    }

    try {
      await runQuery(
        options.client,
        `
        SELECT pg_advisory_xact_lock(
          hashtext($1::text)
        )
        `,
        [candidate.sponsor_user_id]
      );

      const assigned = await assignGlobalSponsor(
        candidate.sponsor_user_id,
        childUserId,
        options
      );

      if (!assigned) {
        throw new Error(
          "V106_GLOBAL_ASSIGNMENT_FAILED"
        );
      }

      return {
        ...assigned,
        business_sponsor_user_id:
          businessSponsorUserId
      };
    } catch (error) {
      if (
        attempt < maxAttempts - 1 &&
        isRetryablePlacementError(error)
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "V106_GLOBAL_ASSIGNMENT_RETRY_EXHAUSTED"
  );
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
  assignGlobalSponsorInSubtree,
  findFirstAvailableGlobalSponsorInSubtree,
  getRuntimeState,
  isRetryablePlacementError,
  resolveRootUser,
  setRootUser,
  transitionPhaseToNormalOperation
};
