const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

if (!process.env.TEST_DATABASE_URL) {
  test(
    "v10.6 step 1 PostgreSQL tests",
    { skip: "TEST_DATABASE_URL absente" },
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
  const schemaName = `v106_step1_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;

  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}", public`);
  await client.query(`
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      sponsor_id uuid NULL,
      is_root boolean NOT NULL DEFAULT false,
      is_leader boolean NOT NULL DEFAULT false,
      is_prelaunch_leader boolean NOT NULL DEFAULT false,
      email_confirmed boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'pending',
      invitation_code_series_1 text NULL,
      invitation_code_series_2 text NULL,
      invitation_code_series_3 text NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT users_sponsor_fk
        FOREIGN KEY (sponsor_id)
        REFERENCES users(id)
        ON DELETE SET NULL
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
    sponsor_id: null,
    is_root: false,
    is_leader: false,
    is_prelaunch_leader: false,
    email_confirmed: false,
    status: "pending",
    ...overrides
  };

  await client.query(
    `
    INSERT INTO users (
      id,
      email,
      sponsor_id,
      is_root,
      is_leader,
      is_prelaunch_leader,
      email_confirmed,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      user.id,
      user.email,
      user.sponsor_id,
      user.is_root,
      user.is_leader,
      user.is_prelaunch_leader,
      user.email_confirmed,
      user.status
    ]
  );

  return user;
}

async function countRows(client, tableName) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  return result.rows[0].count;
}

test("Test 1 - création/lecture du root", async () => {
  const context = await setupDatabase();

  try {
    const user = await insertUser(context.client);
    const state = await runtime.setRootUser(user.id, { client: context.client });
    const root = await runtime.resolveRootUser({ client: context.client });

    assert.equal(state.root_user_id, user.id);
    assert.equal(root.root_user_id, user.id);
    assert.equal(root.id, user.id);
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

    await runtime.assignGlobalSponsor(sponsor.id, child1.id, { client: context.client });
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

    await runtime.assignGlobalSponsor(sponsor.id, child1.id, { client: context.client });
    await runtime.assignGlobalSponsor(sponsor.id, child2.id, { client: context.client });

    await assert.rejects(
      runtime.assignGlobalSponsor(sponsor.id, child3.id, { client: context.client }),
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

    await runtime.assignGlobalSponsor(sponsor.id, child1.id, { client: context.client });

    const operations = await Promise.allSettled([
      db.withTransaction(async (client) => {
        await client.query(`SET search_path TO "${context.schemaName}", public`);
        return runtime.assignGlobalSponsor(sponsor.id, child2.id, { client });
      }),
      db.withTransaction(async (client) => {
        await client.query(`SET search_path TO "${context.schemaName}", public`);
        return runtime.assignGlobalSponsor(sponsor.id, child3.id, { client });
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
    assert.equal(await countRows(context.client, "v106_global_sponsorships"), 2);
  } finally {
    await context.teardown();
  }
});

test("Test 7 - phase initiale LEADER_LAUNCH", async () => {
  const context = await setupDatabase();

  try {
    const state = await runtime.getRuntimeState({ client: context.client });
    assert.equal(state.phase, "LEADER_LAUNCH");
    assert.equal(state.leader_threshold, 50);
  } finally {
    await context.teardown();
  }
});

test("Test 8 - 49 leaders: aucune transition", async () => {
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

    const state = await runtime.transitionPhaseToNormalOperation({
      client: context.client
    });

    assert.equal(state.phase, "LEADER_LAUNCH");
    assert.equal(state.leader_count, 49);
    assert.equal(state.transitioned, false);
  } finally {
    await context.teardown();
  }
});

test("Test 9 - 50 leaders: NORMAL_OPERATION", async () => {
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

    const state = await runtime.transitionPhaseToNormalOperation({
      client: context.client
    });

    assert.equal(state.phase, "NORMAL_OPERATION");
    assert.equal(state.leader_count, 50);
    assert.equal(state.transitioned, true);
  } finally {
    await context.teardown();
  }
});

test("Test 10 - transitions concurrentes: un seul événement", async () => {
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
        await client.query(`SET search_path TO "${context.schemaName}", public`);
        return runtime.transitionPhaseToNormalOperation({ client });
      }),
      db.withTransaction(async (client) => {
        await client.query(`SET search_path TO "${context.schemaName}", public`);
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

test("Test 11 - rollback complet après erreur", async () => {
  const context = await setupDatabase();

  try {
    const sponsor = await insertUser(context.client);
    const child = await insertUser(context.client);

    await assert.rejects(
      db.withTransaction(async (client) => {
        await client.query(`SET search_path TO "${context.schemaName}", public`);
        await runtime.assignGlobalSponsor(sponsor.id, child.id, { client });
        throw new Error("forced failure");
      }),
      /forced failure/
    );

    assert.equal(await countRows(context.client, "v106_global_sponsorships"), 0);
  } finally {
    await context.teardown();
  }
});
