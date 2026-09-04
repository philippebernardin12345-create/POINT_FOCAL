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
    FOR UPDATE
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
    const sponsorLockResult = await runQuery(
      client,
      `
      SELECT id
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [sponsorUserId]
    );

    if (sponsorLockResult.rowCount === 0) {
      throw new Error("V106_SPONSOR_NOT_FOUND");
    }

    const childLockResult = await runQuery(
      client,
      `
      SELECT id
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [childUserId]
    );

    if (childLockResult.rowCount === 0) {
      throw new Error("V106_CHILD_NOT_FOUND");
    }

    if (sponsorUserId === childUserId) {
      throw new Error("V106_SELF_SPONSORING_FORBIDDEN");
    }

    const existingChildResult = await runQuery(
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

    if (existingChildResult.rowCount > 0) {
      const existing = existingChildResult.rows[0];

      if (existing.sponsor_user_id === sponsorUserId) {
        return existing;
      }

      throw new Error("V106_CHILD_ALREADY_ASSIGNED");
    }

    const queue = [sponsorUserId];
    const visited = new Set();

    while (queue.length > 0) {
      const currentSponsorUserId = queue.shift();

      if (!currentSponsorUserId || visited.has(currentSponsorUserId)) {
        continue;
      }

      visited.add(currentSponsorUserId);

      await runQuery(
        client,
        `
        SELECT id
        FROM users
        WHERE id = $1
        FOR UPDATE
        `,
        [currentSponsorUserId]
      );

      const childrenResult = await runQuery(
        client,
        `
        SELECT
          sponsor_user_id,
          child_user_id,
          slot_no
        FROM v106_global_sponsorships
        WHERE sponsor_user_id = $1
        ORDER BY slot_no
        FOR UPDATE
        `,
        [currentSponsorUserId]
      );

      const usedSlots = new Set(
        childrenResult.rows.map((row) => Number(row.slot_no))
      );

      let availableSlot = null;
      if (!usedSlots.has(1)) {
        availableSlot = 1;
      } else if (!usedSlots.has(2)) {
        availableSlot = 2;
      }

      if (availableSlot !== null) {
        try {
          const insertResult = await runQuery(
            client,
            `
            INSERT INTO v106_global_sponsorships (
              sponsor_user_id,
              child_user_id,
              slot_no
            )
            VALUES ($1, $2, $3)
            RETURNING
              sponsor_user_id,
              child_user_id,
              slot_no,
              created_at
            `,
            [
              currentSponsorUserId,
              childUserId,
              availableSlot
            ]
          );

          return insertResult.rows[0] || null;
        } catch (error) {
          if (error && error.code === "23505") {
            const conflictResult = await runQuery(
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

            if (conflictResult.rowCount > 0) {
              const conflict = conflictResult.rows[0];

              if (conflict.sponsor_user_id === sponsorUserId) {
                return conflict;
              }

              throw new Error("V106_CHILD_ALREADY_ASSIGNED");
            }

            continue;
          }

          throw error;
        }
      }

      for (const row of childrenResult.rows) {
        if (!visited.has(row.child_user_id)) {
          queue.push(row.child_user_id);
        }
      }
    }

    throw new Error("V106_SPONSOR_SLOTS_EXHAUSTED");
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
