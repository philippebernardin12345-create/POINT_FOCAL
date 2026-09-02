const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

if (!process.env.TEST_DATABASE_URL) {
  test(
    "v10.6 PostgreSQL integration tests",
    { skip: "TEST_DATABASE_URL non définie" },
    () => {}
  );

  return;
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { runPendingMigrations } = require("../db/migration-runner");
const runtime = require("../db/v106-runtime");
const db = require("../config/db");

function createPool() {
  return new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    family: 4
  });
}

async function setupDatabase() {
  const pool = createPool();
  const client = await pool.connect();
  const schemaName =
    `v106_step1_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;

  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}", public`);
  await client.query(`
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      whatsapp text NULL,
      language text NULL,
      sponsor_id uuid NULL,
      campaign_id uuid NULL,
      invitation_code text NULL,
      is_root boolean NOT NULL DEFAULT false,
      is_leader boolean NOT NULL DEFAULT false,
      is_prelaunch_leader boolean NOT NULL DEFAULT false,
      email_confirmed boolean NOT NULL DEFAULT false,
      link_active boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'pending',
      victory_personal_link text NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT users_sponsor_fk
        FOREIGN KEY (sponsor_id)
        REFERENCES users(id)
        ON DELETE SET NULL
    )
  `);

  await client.query(`
    CREATE TABLE user_opportunities (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id uuid NOT NULL,
      sponsor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      referral_link text NULL,
      target_address text NULL,
      payment_hash text NULL,
      status text NOT NULL DEFAULT 'active',
      joined_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE rollup_logs (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id uuid NOT NULL,
      original_sponsor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      rollup_parent_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  await runPendingMigrations({ client });

  async function teardown() {
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  return {
    client,
    schemaName,
    teardown
  };
}

async function insertUser(client, overrides = {}) {
  const user = {
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@example.com`,
    whatsapp: null,
    language: "fr",
    sponsor_id: null,
    campaign_id: null,
    invitation_code: null,
    is_root: false,
    is_leader: false,
    is_prelaunch_leader: false,
    email_confirmed: false,
    link_active: false,
    status: "pending",
    victory_personal_link: null,
    created_at: overrides.created_at || new Date(),
    ...overrides
  };

  await client.query(
    `
    INSERT INTO users (
      id,
      email,
      whatsapp,
      language,
      sponsor_id,
      campaign_id,
      invitation_code,
      is_root,
      is_leader,
      is_prelaunch_leader,
      email_confirmed,
      link_active,
      status,
      victory_personal_link,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, NOW()
    )
    `,
    [
      user.id,
      user.email,
      user.whatsapp,
      user.language,
      user.sponsor_id,
      user.campaign_id,
      user.invitation_code,
      user.is_root,
      user.is_leader,
      user.is_prelaunch_leader,
      user.email_confirmed,
      user.link_active,
      user.status,
      user.victory_personal_link,
      user.created_at
    ]
  );

  return user;
}

async function countRows(client, tableName) {
  const allowedTables = new Set([
    "v106_global_sponsorships",
    "v106_phase_transition_events",
    "rollup_logs",
    "user_opportunities"
  ]);

  if (!allowedTables.has(tableName)) {
    throw new Error(`Unsupported table: ${tableName}`);
  }

  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM "${tableName}"`
  );
  return result.rows[0].count;
}

test("Test 1 - création/lecture du root runtime", async () => {
  const context = await setupDatabase();

  try {
    const rootUser = await insertUser(context.client, {
      is_root: true,
      email_confirmed: true,
      status: "active"
    });

    const state =
      await runtime.setRootUser(rootUser.id, {
        client: context.client
      });

    const root =
      await runtime.resolveRootUser({
        client: context.client
      });

    assert.equal(state.root_user_id, rootUser.id);
    assert.equal(root.root_user_id, rootUser.id);
    assert.equal(root.id, rootUser.id);
  } finally {
    await context.teardown();
  }
});

test("Test 2 - sponsor global valide", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child = await insertUser(context.client);
    const relation = await runtime.assignGlobalSponsor(
      sponsor.id,
      child.id,
      { client: context.client }
    );

    assert.equal(relation.sponsor_user_id, sponsor.id);
    assert.equal(relation.child_user_id, child.id);
  } finally {
    await context.teardown();
  }
});

test("Test 3 - premier direct prend le slot 1", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child = await insertUser(context.client);
    const relation = await runtime.assignGlobalSponsor(
      sponsor.id,
      child.id,
      { client: context.client }
    );

    assert.equal(relation.slot_no, 1);
  } finally {
    await context.teardown();
  }
});

test("Test 4 - deuxième direct prend le slot 2", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child1 = await insertUser(context.client);
    const child2 = await insertUser(context.client);

    await runtime.assignGlobalSponsor(
      sponsor.id,
      child1.id,
      { client: context.client }
    );

    const relation = await runtime.assignGlobalSponsor(
      sponsor.id,
      child2.id,
      { client: context.client }
    );

    assert.equal(relation.slot_no, 2);
  } finally {
    await context.teardown();
  }
});

test("Test 5 - troisième direct refusé", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child1 = await insertUser(context.client);
    const child2 = await insertUser(context.client);
    const child3 = await insertUser(context.client);

    await runtime.assignGlobalSponsor(sponsor.id, child1.id, {
      client: context.client
    });
    await runtime.assignGlobalSponsor(sponsor.id, child2.id, {
      client: context.client
    });

    await assert.rejects(
      runtime.assignGlobalSponsor(sponsor.id, child3.id, {
        client: context.client
      }),
      /V106_SPONSOR_SLOTS_EXHAUSTED|V106_GLOBAL_SPONSORSHIP_CONFLICT/
    );
  } finally {
    await context.teardown();
  }
});

test("Test 6 - concurrence: jamais plus de deux directs", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child1 = await insertUser(context.client);
    const child2 = await insertUser(context.client);
    const child3 = await insertUser(context.client);

    await runtime.assignGlobalSponsor(sponsor.id, child1.id, {
      client: context.client
    });

    const operations = await Promise.allSettled([
      db.withTransaction(async (client) => {
        await client.query(
          `SET search_path TO "${context.schemaName}", public`
        );

        return runtime.assignGlobalSponsor(
          sponsor.id,
          child2.id,
          { client }
        );
      }),
      db.withTransaction(async (client) => {
        await client.query(
          `SET search_path TO "${context.schemaName}", public`
        );

        return runtime.assignGlobalSponsor(
          sponsor.id,
          child3.id,
          { client }
        );
      })
    ]);

    assert.equal(
      operations.filter((operation) => operation.status === "fulfilled").length,
      1
    );
    assert.equal(
      operations.filter((operation) => operation.status === "rejected").length,
      1
    );
    assert.equal(
      await countRows(context.client, "v106_global_sponsorships"),
      2
    );
  } finally {
    await context.teardown();
  }
});

test("Test 7 - assignation globale suit root puis FIFO", async () => {
  const context = await setupDatabase();

  try {
    const root = await insertUser(context.client, {
      is_root: true,
      email_confirmed: true,
      status: "active",
      created_at: new Date("2026-01-01T00:00:00Z")
    });

    await runtime.setRootUser(root.id, {
      client: context.client
    });

    const child1 = await insertUser(context.client, {
      email_confirmed: true,
      status: "active",
      created_at: new Date("2026-01-02T00:00:00Z")
    });
    const child2 = await insertUser(context.client, {
      email_confirmed: true,
      status: "active",
      created_at: new Date("2026-01-03T00:00:00Z")
    });
    const child3 = await insertUser(context.client, {
      email_confirmed: true,
      status: "active",
      created_at: new Date("2026-01-04T00:00:00Z")
    });

    const first = await runtime.assignNextGlobalSponsor(
      child1.id,
      { client: context.client }
    );
    const second = await runtime.assignNextGlobalSponsor(
      child2.id,
      { client: context.client }
    );
    const third = await runtime.assignNextGlobalSponsor(
      child3.id,
      { client: context.client }
    );

    assert.equal(first.sponsor_user_id, root.id);
    assert.equal(second.sponsor_user_id, root.id);
    assert.equal(third.sponsor_user_id, child1.id);
  } finally {
    await context.teardown();
  }
});

test("Test 8 - phase initiale LEADER_LAUNCH", async () => {
  const context = await setupDatabase();

  try {
    const state = await runtime.getRuntimeState({
      client: context.client
    });

    assert.equal(state.phase, "LEADER_LAUNCH");
    assert.equal(state.leader_threshold, 50);
  } finally {
    await context.teardown();
  }
});

test("Test 9 - 49 leaders: aucune transition", async () => {
  const context = await setupDatabase();

  try {
    for (let index = 0; index < 49; index += 1) {
      await insertUser(context.client, {
        is_leader: true,
        is_prelaunch_leader: true,
        email_confirmed: true,
        status: "active"
      });
    }

    const state =
      await runtime.transitionPhaseToNormalOperation({
        client: context.client
      });

    assert.equal(state.phase, "LEADER_LAUNCH");
    assert.equal(state.leader_count, 49);
    assert.equal(state.transitioned, false);
  } finally {
    await context.teardown();
  }
});

test("Test 10 - pending/non confirmés exclus du comptage leader", async () => {
  const context = await setupDatabase();

  try {
    for (let index = 0; index < 49; index += 1) {
      await insertUser(context.client, {
        is_leader: true,
        is_prelaunch_leader: true,
        email_confirmed: true,
        status: "active"
      });
    }

    await insertUser(context.client, {
      is_leader: true,
      is_prelaunch_leader: true,
      email_confirmed: false,
      status: "pending"
    });

    const state =
      await runtime.transitionPhaseToNormalOperation({
        client: context.client
      });

    assert.equal(state.phase, "LEADER_LAUNCH");
    assert.equal(state.leader_count, 49);
  } finally {
    await context.teardown();
  }
});

test("Test 11 - 50 leaders: NORMAL_OPERATION", async () => {
  const context = await setupDatabase();

  try {
    for (let index = 0; index < 50; index += 1) {
      await insertUser(context.client, {
        is_leader: true,
        is_prelaunch_leader: index < 49,
        email_confirmed: true,
        status: "active"
      });
    }

    const state =
      await runtime.transitionPhaseToNormalOperation({
        client: context.client
      });

    assert.equal(state.phase, "NORMAL_OPERATION");
    assert.equal(state.leader_count, 50);
    assert.equal(state.transitioned, true);
  } finally {
    await context.teardown();
  }
});

test("Test 12 - 51e leader: reste NORMAL_OPERATION et idempotent", async () => {
  const context = await setupDatabase();

  try {
    for (let index = 0; index < 50; index += 1) {
      await insertUser(context.client, {
        is_leader: true,
        is_prelaunch_leader: false,
        email_confirmed: true,
        status: "active"
      });
    }

    await context.client.query(`
      UPDATE v106_runtime_state
      SET phase = 'NORMAL_OPERATION', leader_count = 50
      WHERE singleton_id = true
    `);

    const state = await runtime.transitionPhaseToNormalOperation({
      client: context.client
    });

    assert.equal(state.phase, "NORMAL_OPERATION");
    assert.equal(state.leader_count, 50);
    assert.equal(state.transitioned, false);
    assert.equal(
      await countRows(context.client, "v106_phase_transition_events"),
      0
    );
  } finally {
    await context.teardown();
  }
});

test("Test 13 - transitions concurrentes: un seul événement", async () => {
  const context = await setupDatabase();

  try {
    for (let index = 0; index < 50; index += 1) {
      await insertUser(context.client, {
        is_leader: true,
        is_prelaunch_leader: true,
        email_confirmed: true,
        status: "active"
      });
    }

    const operations = await Promise.all([
      db.withTransaction(async (client) => {
        await client.query(
          `SET search_path TO "${context.schemaName}", public`
        );
        return runtime.transitionPhaseToNormalOperation({ client });
      }),
      db.withTransaction(async (client) => {
        await client.query(
          `SET search_path TO "${context.schemaName}", public`
        );
        return runtime.transitionPhaseToNormalOperation({ client });
      })
    ]);

    const events = await context.client.query(
      "SELECT COUNT(*)::int AS count FROM v106_phase_transition_events"
    );

    assert.equal(operations[0].phase, "NORMAL_OPERATION");
    assert.equal(operations[1].phase, "NORMAL_OPERATION");
    assert.equal(events.rows[0].count, 1);
  } finally {
    await context.teardown();
  }
});

test("Test 14 - rollback complet après erreur", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child = await insertUser(context.client);

    await assert.rejects(
      db.withTransaction(async (client) => {
        await client.query(
          `SET search_path TO "${context.schemaName}", public`
        );
        await runtime.assignGlobalSponsor(
          sponsor.id,
          child.id,
          { client }
        );
        throw new Error("forced failure");
      }),
      /forced failure/
    );

    assert.equal(
      await countRows(context.client, "v106_global_sponsorships"),
      0
    );
  } finally {
    await context.teardown();
  }
});
