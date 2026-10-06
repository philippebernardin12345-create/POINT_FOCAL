const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

if (!process.env.TEST_DATABASE_URL) {
  test("S5 FIFO 1 PostgreSQL tests", { skip: "TEST_DATABASE_URL non définie" }, () => {});
  return;
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { Pool } = require("pg");
const authRepository = require("../modules/auth/auth.repository");

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4
  });
  const client = await pool.connect();
  const schemaName = "s5_fifo1_" + crypto.randomUUID().replace(/-/g, "");

  await client.query('CREATE SCHEMA "' + schemaName + '"');
  await client.query('SET search_path TO "' + schemaName + '", public');
  await client.query(`
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      invitation_code text,
      link_active boolean NOT NULL DEFAULT false,
      email_confirmed boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL
    )
  `);
  await client.query(`
    CREATE TABLE v106_runtime_state (
      singleton_id boolean PRIMARY KEY DEFAULT true CHECK (singleton_id = true),
      root_user_id uuid
    )
  `);
  await client.query(`
    CREATE TABLE v106_global_sponsorships (
      sponsor_user_id uuid NOT NULL,
      child_user_id uuid NOT NULL,
      slot_no smallint NOT NULL,
      PRIMARY KEY (sponsor_user_id, slot_no),
      UNIQUE (child_user_id)
    )
  `);

  async function teardown() {
    try {
      await client.query('DROP SCHEMA IF EXISTS "' + schemaName + '" CASCADE');
    } finally {
      client.release();
      await pool.end();
    }
  }

  return { client, pool, schemaName, teardown };
}

async function insertUser(client, overrides = {}) {
  const user = {
    id: crypto.randomUUID(),
    email: crypto.randomUUID() + "@example.com",
    invitationCode: null,
    linkActive: true,
    emailConfirmed: true,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides
  };

  await client.query(
    `INSERT INTO users (
       id, email, invitation_code, link_active, email_confirmed, status, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.id,
      user.email,
      user.invitationCode,
      user.linkActive,
      user.emailConfirmed,
      user.status,
      user.createdAt
    ]
  );
  return user;
}

async function setRoot(client, rootId) {
  await client.query(
    "INSERT INTO v106_runtime_state (singleton_id, root_user_id) VALUES (true, $1)",
    [rootId]
  );
}

async function addPlacement(client, sponsorId, childId, slotNo) {
  await client.query(
    "INSERT INTO v106_global_sponsorships (sponsor_user_id, child_user_id, slot_no) VALUES ($1, $2, $3)",
    [sponsorId, childId, slotNo]
  );
}

test("S5 FIFO 1 - choisit le candidat admissible le plus ancien et exclut root/saturés/invalides", async () => {
  const context = await setupDatabase();

  try {
    const root = await insertUser(context.client, {
      createdAt: "2020-01-01T00:00:00Z"
    });
    await setRoot(context.client, root.id);

    const full = await insertUser(context.client, {
      createdAt: "2021-01-01T00:00:00Z"
    });
    await addPlacement(context.client, full.id, crypto.randomUUID(), 1);
    await addPlacement(context.client, full.id, crypto.randomUUID(), 2);

    await insertUser(context.client, {
      linkActive: false,
      createdAt: "2022-01-01T00:00:00Z"
    });
    await insertUser(context.client, {
      emailConfirmed: false,
      createdAt: "2022-02-01T00:00:00Z"
    });
    await insertUser(context.client, {
      status: "suspended",
      createdAt: "2022-03-01T00:00:00Z"
    });

    const oldest = await insertUser(context.client, {
      id: "00000000-0000-4000-8000-000000000010",
      createdAt: "2023-01-01T00:00:00Z"
    });
    await insertUser(context.client, {
      id: "00000000-0000-4000-8000-000000000020",
      createdAt: "2023-01-01T00:00:00Z"
    });

    await context.client.query("BEGIN");
    const selected = await authRepository.findOldestAvailableSponsorForFifo({
      client: context.client
    });
    await context.client.query("COMMIT");

    assert.equal(selected.id, oldest.id);
  } finally {
    await context.teardown();
  }
});

test("S5 FIFO 1 - renvoie null quand aucun parrain n'est admissible", async () => {
  const context = await setupDatabase();

  try {
    const root = await insertUser(context.client);
    await setRoot(context.client, root.id);
    await insertUser(context.client, { linkActive: false });
    await insertUser(context.client, { emailConfirmed: false });
    await insertUser(context.client, { status: "suspended" });

    await context.client.query("BEGIN");
    const selected = await authRepository.findOldestAvailableSponsorForFifo({
      client: context.client
    });
    await context.client.query("COMMIT");

    assert.equal(selected, null);
  } finally {
    await context.teardown();
  }
});

test("S5 FIFO 1 - une course au dernier slot passe au prochain candidat", async () => {
  const context = await setupDatabase();
  let firstClient;
  let secondClient;

  try {
    const root = await insertUser(context.client);
    await setRoot(context.client, root.id);

    const first = await insertUser(context.client, {
      createdAt: "2023-01-01T00:00:00Z"
    });
    const second = await insertUser(context.client, {
      createdAt: "2023-02-01T00:00:00Z"
    });
    await addPlacement(context.client, first.id, crypto.randomUUID(), 1);

    firstClient = await context.pool.connect();
    secondClient = await context.pool.connect();
    await firstClient.query('SET search_path TO "' + context.schemaName + '", public');
    await secondClient.query('SET search_path TO "' + context.schemaName + '", public');

    await firstClient.query("BEGIN");
    const firstSelection = await authRepository.findOldestAvailableSponsorForFifo({
      client: firstClient
    });
    assert.equal(firstSelection.id, first.id);

    await addPlacement(firstClient, first.id, crypto.randomUUID(), 2);

    await secondClient.query("BEGIN");
    let lockQuerySubmitted;
    const lockQueryStarted = new Promise((resolve) => {
      lockQuerySubmitted = resolve;
    });
    const secondRunner = {
      query(sql, params) {
        const result = secondClient.query(sql, params);
        if (sql.includes("FOR UPDATE")) {
          lockQuerySubmitted();
        }
        return result;
      }
    };
    const secondSelectionPromise =
      authRepository.findOldestAvailableSponsorForFifo({ client: secondRunner });

    await lockQueryStarted;
    await firstClient.query("COMMIT");
    const secondSelection = await secondSelectionPromise;
    await secondClient.query("COMMIT");

    assert.equal(secondSelection.id, second.id);
  } finally {
    if (firstClient) {
      try { await firstClient.query("ROLLBACK"); } catch (_) {}
      firstClient.release();
    }
    if (secondClient) {
      try { await secondClient.query("ROLLBACK"); } catch (_) {}
      secondClient.release();
    }
    await context.teardown();
  }
});
