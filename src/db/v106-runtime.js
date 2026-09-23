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
  const result = await runQuery(
    options.client,
    `
    SELECT
      sponsor_user_id,
      child_user_id,
      slot_no,
      created_at
    FROM v106_assign_global_sponsor(
      $1::uuid,
      $2::uuid
    )
    `,
    [sponsorUserId, childUserId]
  );

  return result.rows[0] || null;
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
