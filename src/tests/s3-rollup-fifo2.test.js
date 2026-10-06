const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

// config/db is loaded by the service under test; route it only to the test URL.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/*
 * S3 — Tests unitaires de la logique consolidée Roll-Up + FIFO 2.
 * Ces tests utilisent un client SQL minimal afin de verrouiller les invariants
 * métier sans dépendre d'une base distante.
 */

function loadV2WithRoot(root, dbQuery = null) {
  const runtimePath = require.resolve("../db/v106-runtime");
  const dbPath = require.resolve("../config/db");
  const servicePath = require.resolve("../core/v2-rotation.service");
  const originalRuntime = require.cache[runtimePath];
  const originalDb = require.cache[dbPath];

  require.cache[runtimePath] = {
    id: runtimePath,
    filename: runtimePath,
    loaded: true,
    exports: { resolveRootUser: async () => root }
  };
  if (dbQuery) {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {
        query: dbQuery,
        withTransaction: async (callback) => callback({ query: dbQuery })
      }
    };
  }
  delete require.cache[servicePath];
  const service = require(servicePath);

  return {
    service,
    restore() {
      delete require.cache[servicePath];
      if (originalRuntime) require.cache[runtimePath] = originalRuntime;
      else delete require.cache[runtimePath];
      if (originalDb) require.cache[dbPath] = originalDb;
      else delete require.cache[dbPath];
    }
  };
}

function loadRollupServiceForTest(root) {
  const servicePath = require.resolve("../core/rollup.service");
  const overrides = [
    [
      require.resolve("../modules/users/users.repository"),
      { findUserById: async (id) => ({ id, sponsor_id: null }) }
    ],
    [
      require.resolve("../core/opportunity.engine"),
      { getOpportunityById: async () => ({ id: "test-opportunity" }) }
    ],
    [
      require.resolve("../config/db"),
      {
        query: async () => ({ rows: [] }),
        withTransaction: async (callback) => callback({ query: async () => ({ rows: [] }) })
      }
    ],
    [
      require.resolve("../utils/logger"),
      { logger: { error() {}, warn() {} } }
    ],
    [
      require.resolve("../db/v106-runtime"),
      { resolveRootUser: async () => root }
    ],
    [
      require.resolve("../core/v2-rotation.service"),
      { isConfirmedInactive: async () => false }
    ]
  ];
  const originals = new Map(
    overrides.map(([path]) => [path, require.cache[path]])
  );

  for (const [path, exports] of overrides) {
    require.cache[path] = {
      id: path,
      filename: path,
      loaded: true,
      exports
    };
  }

  const originalService = require.cache[servicePath];
  delete require.cache[servicePath];
  const service = require(servicePath);

  return {
    service,
    restore() {
      delete require.cache[servicePath];
      if (originalService) require.cache[servicePath] = originalService;
      for (const [path, original] of originals) {
        if (original) require.cache[path] = original;
        else delete require.cache[path];
      }
    }
  };
}

function makeClient({ children = {}, confirmed = [], counts = {} }) {
  const confirmedSet = new Set(confirmed.map(([u, o]) => `${u}:${o}`));
  return {
    async query(sql, params) {
        if (sql.includes("pg_advisory_xact_lock")) {
          return { rows: [{ pg_advisory_xact_lock: null }] };
        }
      if (sql.includes("opportunity_inactivity_confirmations")) {
        return { rows: confirmedSet.has(`${params[0]}:${params[1]}`) ? [{ ok: 1 }] : [] };
      }
      if (sql.includes("FROM v106_global_sponsorships")) {
        return { rows: (children[String(params[0])] || []).map((id, index) => ({
          child_user_id: id,
          slot_no: index + 1,
          created_at: new Date(index * 1000),
          status: "active",
          email_confirmed: true,
          link_active: true
        })) };
      }
      if (
        sql.includes("FROM user_opportunities") &&
        sql.includes("COUNT(DISTINCT uo.user_id)") &&
        sql.includes("FROM rollup_logs")
      ) {
        return { rows: [{ count: counts[`${params[0]}:${params[1]}`] || 0 }] };
      }
      throw new Error(`Unexpected SQL in S3 mock: ${sql}`);
    }
  };
}

test("S3 - aucun FIFO2 sans inactivité confirmée du compte Y dans l'opportunité", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({ children: { root: ["a"] } });
    await assert.rejects(loaded.service.getV2Parent("new", "oppA", { client }), /FIFO2_ACCOUNT_INACTIVITY_NOT_CONFIRMED/);
  } finally { loaded.restore(); }
});

test("S3 - confirmation de Y dans A ne rend pas Y inactif dans B", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({ confirmed: [["root", "oppA"]] });
    await assert.rejects(loaded.service.getV2Parent("new", "oppB", { client }), /FIFO2_ACCOUNT_INACTIVITY_NOT_CONFIRMED/);
  } finally { loaded.restore(); }
});

test("S3 - compte indisponible sauté mais descendance conservée", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({
      children: { root: ["a"], a: ["a1"] },
      confirmed: [["root", "opp"], ["a", "opp"]]
    });
    const result = await loaded.service.getV2Parent("new", "opp", { client });
    assert.equal(result.parentId, "a1");
  } finally { loaded.restore(); }
});


test("S3 - un compte Y non-racine confirmé inactif déclenche FIFO2 depuis sa descendance", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({
      children: {
        root: ["y"],
        y: ["y1", "y2"]
      },
      confirmed: [["y", "opp"]]
    });

    const result = await loaded.service.getV2Parent("new", "opp", {
      client,
      unavailableUserId: "y"
    });

    assert.equal(result.parentId, "y1");
    assert.equal(result.unavailableUserId, "y");
    assert.equal(result.rootId, "root");
    assert.equal(result.structuralRootUnchanged, true);
  } finally {
    loaded.restore();
  }
});

test("S3 - vérification d'inactivité sans client utilise la connexion DB par défaut", async () => {
  let calls = 0;
  const loaded = loadV2WithRoot(
    { id: "root" },
    async (sql, params) => {
      calls += 1;
      assert.match(sql, /opportunity_inactivity_confirmations/);
      assert.deepEqual(params, ["y", "oppA"]);
      return { rows: [{ ok: 1 }] };
    }
  );

  try {
    assert.equal(
      await loaded.service.isConfirmedInactive(null, "y", "oppA"),
      true
    );
    assert.equal(calls, 1);
  } finally {
    loaded.restore();
  }
});

test("S3 - capacité commune 2 : un parent déjà à 2 est sauté", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({
      children: { root: ["a", "b"] },
      confirmed: [["root", "opp"]],
      counts: { "a:opp": 2, "b:opp": 1 }
    });
    const result = await loaded.service.getV2Parent("new", "opp", { client });
    assert.equal(result.parentId, "b");
    assert.equal(result.capacityUsed, 1);
    assert.equal(result.capacityRemaining, 1);
  } finally { loaded.restore(); }
});

test("S3 - FIFO2 ne remplace jamais root_user_id", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const result = await loaded.service.rotateIfRootInactive({ client: makeClient({}) });
    assert.equal(result.rotated, false);
    assert.equal(result.reason, "structural_root_is_immutable");
    assert.equal(result.rootUserId, "root");
  } finally { loaded.restore(); }
});
function supabaseProjectRef(connectionString) {
  const url = new URL(connectionString);
  const host = url.hostname.toLowerCase();

  if (host.endsWith(".pooler.supabase.com")) {
    const username = decodeURIComponent(url.username);
    const projectRef = username.split(".").slice(1).join(".");
    if (!projectRef) throw new Error("SUPABASE_PROJECT_REF_NOT_FOUND");
    return projectRef.toLowerCase();
  }

  const direct = host.match(/^db\.([^.]+)\.supabase\.co$/);
  if (direct) return direct[1].toLowerCase();

  throw new Error("UNRECOGNIZED_SUPABASE_DATABASE_URL");
}

function assertTestDatabaseIsDistinct() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL_REQUIRED");
  const productionProjectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF;
  if (!productionProjectRef) {
    throw new Error("PRODUCTION_SUPABASE_PROJECT_REF_REQUIRED");
  }
  if (supabaseProjectRef(testUrl) === productionProjectRef.trim().toLowerCase()) {
    throw new Error("TEST_DATABASE_URL_MATCHES_PRODUCTION_PROJECT");
  }
}

async function waitForAdvisoryWaiter(pool, pid) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_locks
         WHERE pid = $1 AND locktype = 'advisory' AND NOT granted
       ) AS waiting`,
      [pid]
    );
    if (result.rows[0].waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("FIFO2_ADVISORY_LOCK_WAITER_TIMEOUT");
}

async function canAcquireCapacityLock(pool, parentId, opportunityId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT pg_try_advisory_xact_lock(
         hashtextextended($1::text || ':' || $2::text, 0)
       ) AS acquired`,
      [parentId, opportunityId]
    );
    return result.rows[0].acquired;
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

async function writePlacement(
  client,
  userId,
  opportunityId,
  parentId,
  reason = "confirmed_account_inactivity_fifo2"
) {
  await client.query(
    `INSERT INTO user_opportunities (user_id, opportunity_id, sponsor_user_id, status)
     VALUES ($1, $2, $3, 'active')`,
    [userId, opportunityId, parentId]
  );
  await client.query(
    `INSERT INTO rollup_logs (user_id, opportunity_id, rollup_parent_id, reason)
     VALUES ($1, $2, $3, $4)`,
    [userId, opportunityId, parentId, reason]
  );
}

test("S3 PostgreSQL - concurrence capacité jumelée et durée du verrou transactionnel", {
  skip: !process.env.TEST_DATABASE_URL
    ? "TEST_DATABASE_URL non définie"
    : false
}, async () => {
  // Cette comparaison est faite avant le premier CREATE/DROP de schéma.
  assertTestDatabaseIsDistinct();

  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4,
    max: 6
  });
  const schema = `s3_concurrency_${crypto.randomUUID().replace(/-/g, "")}`;
  let first;
  let second;
  let loaded;
  let seed;

  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    const setup = await pool.connect();
    try {
      await setup.query(`SET search_path TO "${schema}"`);
      await setup.query(`
        CREATE TABLE users (
          id uuid PRIMARY KEY,
          status text NOT NULL,
          email_confirmed boolean NOT NULL,
          link_active boolean NOT NULL
        );
        CREATE TABLE v106_global_sponsorships (
          sponsor_user_id uuid NOT NULL,
          child_user_id uuid NOT NULL,
          slot_no integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE opportunity_inactivity_confirmations (
          user_id uuid NOT NULL,
          opportunity_id uuid NOT NULL,
          state text NOT NULL
        );
        CREATE TABLE user_opportunities (
          id bigserial PRIMARY KEY,
          user_id uuid NOT NULL,
          opportunity_id uuid NOT NULL,
          sponsor_user_id uuid,
          status text NOT NULL,
          joined_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (user_id, opportunity_id)
        );
        CREATE TABLE rollup_logs (
          user_id uuid NOT NULL,
          opportunity_id uuid NOT NULL,
          original_sponsor_id uuid,
          rollup_parent_id uuid NOT NULL,
          reason text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
    } finally {
      setup.release();
    }

    const rootId = crypto.randomUUID();
    const parentA = crypto.randomUUID();
    const parentB = crypto.randomUUID();
    const opportunityId = crypto.randomUUID();
    const existingPlacement = crypto.randomUUID();
    const incomingA = crypto.randomUUID();
    const incomingB = crypto.randomUUID();

    seed = await pool.connect();
    await seed.query(`SET search_path TO "${schema}"`);
    await seed.query(
      `INSERT INTO users (id, status, email_confirmed, link_active)
       VALUES ($1, 'active', true, true), ($2, 'active', true, true),
              ($3, 'active', true, true)`,
      [rootId, parentA, parentB]
    );
    await seed.query(
      `INSERT INTO v106_global_sponsorships (sponsor_user_id, child_user_id, slot_no)
       VALUES ($1, $2, 1), ($1, $3, 2)`,
      [rootId, parentA, parentB]
    );
    await seed.query(
      `INSERT INTO opportunity_inactivity_confirmations (user_id, opportunity_id, state)
       VALUES ($1, $2, 'confirmed')`,
      [rootId, opportunityId]
    );
    await writePlacement(
      seed,
      existingPlacement,
      opportunityId,
      parentA,
      "sponsor_not_in_opportunity"
    );
    seed.release();
    seed = null;

    loaded = loadV2WithRoot({ id: rootId });
    first = await pool.connect();
    second = await pool.connect();
    await first.query("BEGIN");
    await first.query(`SET search_path TO "${schema}"`);
    await second.query("BEGIN");
    await second.query(`SET search_path TO "${schema}"`);

    const firstParent = await loaded.service.getV2Parent(incomingA, opportunityId, {
      client: first,
      unavailableUserId: rootId
    });
    assert.equal(firstParent.parentId, parentA);
    assert.equal(firstParent.capacityUsed, 1);
    assert.equal(await canAcquireCapacityLock(pool, parentA, opportunityId), false);

    const secondPid = (await second.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const secondSelection = loaded.service.getV2Parent(incomingB, opportunityId, {
      client: second,
      unavailableUserId: rootId
    });
    secondSelection.catch(() => {});
    await waitForAdvisoryWaiter(pool, secondPid);

    await writePlacement(first, incomingA, opportunityId, firstParent.parentId);
    assert.equal(await canAcquireCapacityLock(pool, parentA, opportunityId), false);
    await first.query("COMMIT");
    first.release();
    first = null;

    const secondParent = await secondSelection;
    assert.equal(secondParent.parentId, parentB);
    await writePlacement(second, incomingB, opportunityId, secondParent.parentId);
    await second.query("COMMIT");
    second.release();
    second = null;

    const counts = await pool.query(
      `SELECT sponsor_user_id, COUNT(*)::int AS count
       FROM "${schema}".user_opportunities
       WHERE opportunity_id = $1 AND status = 'active'
       GROUP BY sponsor_user_id`,
      [opportunityId]
    );
    const byParent = new Map(counts.rows.map((row) => [row.sponsor_user_id, row.count]));
    assert.equal(byParent.get(parentA), 2, "le premier parent doit finir à exactement 2");
    assert.equal(byParent.get(parentB), 1, "la transaction concurrente doit avancer au parent suivant");

    // Un Roll-Up normal partage le verrou/la capacité avec les placements FIFO 2.
    const normalRollup = loadRollupServiceForTest({ id: parentB });
    const rollupClient = await pool.connect();
    try {
      await rollupClient.query("BEGIN");
      await rollupClient.query(`SET search_path TO "${schema}"`);
      const rollupResult = await normalRollup.service.applyRollup(
        crypto.randomUUID(),
        opportunityId,
        { client: rollupClient }
      );
      assert.equal(rollupResult.action, "rollup");
      assert.equal(rollupResult.rollupParentId, parentB);
      assert.equal(await canAcquireCapacityLock(pool, parentB, opportunityId), false);
      await rollupClient.query("COMMIT");
      assert.equal(await canAcquireCapacityLock(pool, parentB, opportunityId), true);
    } finally {
      try { await rollupClient.query("ROLLBACK"); } catch (_) {}
      normalRollup.restore();
      rollupClient.release();
    }

    const fullCapacityService = loadRollupServiceForTest({ id: parentB });
    const fullCapacityClient = await pool.connect();
    try {
      await fullCapacityClient.query("BEGIN");
      await fullCapacityClient.query(`SET search_path TO "${schema}"`);
      await assert.rejects(
        fullCapacityService.service.applyRollup(
          crypto.randomUUID(),
          opportunityId,
          { client: fullCapacityClient }
        ),
        /ROLLUP_PARENT_CAPACITY_EXHAUSTED/
      );
      await fullCapacityClient.query("ROLLBACK");
    } finally {
      try { await fullCapacityClient.query("ROLLBACK"); } catch (_) {}
      fullCapacityService.restore();
      fullCapacityClient.release();
    }
    const finalParentB = await pool.query(
      `SELECT COUNT(*)::int AS count
         FROM "${schema}".user_opportunities uo
        WHERE uo.sponsor_user_id = $1
          AND uo.opportunity_id = $2
          AND uo.status = 'active'
          AND EXISTS (
            SELECT 1 FROM "${schema}".rollup_logs rl
             WHERE rl.user_id = uo.user_id
               AND rl.opportunity_id = uo.opportunity_id
               AND rl.rollup_parent_id = uo.sponsor_user_id
          )`,
      [parentB, opportunityId]
    );
    assert.equal(finalParentB.rows[0].count, 2, "Roll-Up + FIFO 2 ne dépassent jamais deux placements");

    // Un verrou xactuel doit également être libéré par ROLLBACK.
    const rollbackClient = await pool.connect();
    try {
      await rollbackClient.query("BEGIN");
      await rollbackClient.query(`SET search_path TO "${schema}"`);
      const rollbackCandidate = await loaded.service.getV2Parent(crypto.randomUUID(), opportunityId, {
        client: rollbackClient,
        unavailableUserId: rootId
      });
      assert.equal(rollbackCandidate.parentId, parentB);
      assert.equal(await canAcquireCapacityLock(pool, parentB, opportunityId), false);
      await rollbackClient.query("ROLLBACK");
      assert.equal(await canAcquireCapacityLock(pool, parentB, opportunityId), true);
    } finally {
      rollbackClient.release();
    }
  } finally {
    if (seed) seed.release();
    if (first) {
      try { await first.query("ROLLBACK"); } catch (_) {}
      first.release();
    }
    if (second) {
      try { await second.query("ROLLBACK"); } catch (_) {}
      second.release();
    }
    if (loaded) loaded.restore();
    try { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally { await pool.end(); }
  }
});
