const db = require("../../config/db");

function getExecutor(client) {
  return client && typeof client.query === "function"
    ? client
    : db;
}

async function ensureRuntimeState(client) {
  const executor = getExecutor(client);

  await executor.query(`
    INSERT INTO v106_runtime_state (singleton_key)
    VALUES (true)
    ON CONFLICT (singleton_key) DO NOTHING
  `);
}

async function setRootUser(rootUserId, options = {}) {
  const executor = getExecutor(options.client);

  await ensureRuntimeState(options.client);

  const result = await executor.query(
    `
    UPDATE v106_runtime_state runtime
    SET
      root_user_id = candidate.id,
      updated_at = NOW()
    FROM users candidate
    WHERE runtime.singleton_key = true
      AND candidate.id = $1
      AND candidate.is_root = true
    RETURNING runtime.root_user_id
    `,
    [rootUserId]
  );

  if (!result.rows[0]) {
    throw new Error(
      "Impossible de définir le root V10.6 avec cet utilisateur."
    );
  }

  return resolveRootUser(options);
}

async function resolveRootUser(options = {}) {
  const executor = getExecutor(options.client);

  await ensureRuntimeState(options.client);

  const explicitResult = await executor.query(`
    SELECT
      users.id,
      users.email,
      users.is_root,
      runtime.root_user_id,
      true AS is_explicit
    FROM v106_runtime_state runtime
    JOIN users
      ON users.id = runtime.root_user_id
    WHERE runtime.singleton_key = true
    LIMIT 1
  `);

  if (explicitResult.rows[0]) {
    return explicitResult.rows[0];
  }

  const legacyResult = await executor.query(`
    SELECT
      users.id,
      users.email,
      users.is_root,
      users.id AS root_user_id,
      false AS is_explicit
    FROM users
    WHERE users.is_root = true
    ORDER BY users.created_at ASC, users.id ASC
    LIMIT 1
  `);

  return legacyResult.rows[0] || null;
}

async function assignGlobalSponsor(
  {
    sponsorUserId,
    childUserId,
    assignmentSource = "V10_6"
  },
  options = {}
) {
  const executor = getExecutor(options.client);

  const result = await executor.query(
    `
    SELECT *
    FROM v106_assign_global_sponsor($1, $2, $3)
    `,
    [
      sponsorUserId,
      childUserId,
      assignmentSource
    ]
  );

  return result.rows[0] || null;
}

async function listGlobalSponsorAssignments(
  sponsorUserId,
  options = {}
) {
  const executor = getExecutor(options.client);

  const result = await executor.query(
    `
    SELECT
      sponsor_user_id,
      child_user_id,
      slot_no,
      assignment_source,
      created_at
    FROM v106_global_sponsorships
    WHERE sponsor_user_id = $1
    ORDER BY slot_no ASC
    `,
    [sponsorUserId]
  );

  return result.rows;
}

async function getPhaseState(options = {}) {
  const executor = getExecutor(options.client);

  await ensureRuntimeState(options.client);

  const result = await executor.query(`
    SELECT
      runtime.root_user_id,
      runtime.current_phase,
      runtime.leader_threshold,
      runtime.transitioned_to_normal_operation_at,
      (
        SELECT COUNT(*)::int
        FROM v106_prelaunch_leader_candidates
      ) AS leader_count
    FROM v106_runtime_state runtime
    WHERE runtime.singleton_key = true
    LIMIT 1
  `);

  return result.rows[0] || null;
}

async function transitionToNormalOperationIfThresholdMet(
  reason = "leader_threshold_reached",
  options = {}
) {
  const executor = getExecutor(options.client);

  const result = await executor.query(
    `
    SELECT *
    FROM v106_transition_phase_to_normal_operation($1)
    `,
    [reason]
  );

  return result.rows[0] || null;
}

async function listPhaseTransitions(options = {}) {
  const executor = getExecutor(options.client);

  const result = await executor.query(`
    SELECT
      phase_from,
      phase_to,
      trigger_reason,
      leader_count_snapshot,
      created_at
    FROM v106_phase_transition_events
    ORDER BY created_at ASC
  `);

  return result.rows;
}

module.exports = {
  assignGlobalSponsor,
  ensureRuntimeState,
  getPhaseState,
  listGlobalSponsorAssignments,
  listPhaseTransitions,
  resolveRootUser,
  setRootUser,
  transitionToNormalOperationIfThresholdMet
};
