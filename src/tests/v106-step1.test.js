const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const {
  startTemporaryPostgres
} = require("./support/postgres-cluster");
const {
  LEGACY_SCHEMA_SQL
} = require("./support/legacy-schema");

let cluster;
let pool;
let db;
let migrationRunner;
let v106Repository;

function uuid() {
  return crypto.randomUUID();
}

async function resetDatabase() {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(LEGACY_SCHEMA_SQL);
  await migrationRunner.runMigrations();
}

async function insertCampaign(id = uuid()) {
  await pool.query(
    `
    INSERT INTO campaigns (id, name, status)
    VALUES ($1, $2, 'active')
    `,
    [id, `campaign-${id}`]
  );

  return id;
}

async function insertUser(overrides = {}) {
  const id = overrides.id || uuid();
  const campaignId =
    overrides.campaignId ||
    (await insertCampaign());

  await pool.query(
    `
    INSERT INTO users (
      id,
      email,
      sponsor_id,
      campaign_id,
      is_root,
      is_leader,
      is_prelaunch_leader,
      email_confirmed,
      link_active,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    `,
    [
      id,
      overrides.email || `${id}@pointfocal.test`,
      overrides.sponsorId || null,
      campaignId,
      overrides.isRoot === true,
      overrides.isLeader === true,
      overrides.isPrelaunchLeader === true,
      overrides.emailConfirmed === true,
      overrides.linkActive === true,
      overrides.status || "active"
    ]
  );

  return {
    id,
    campaignId
  };
}

async function countAssignmentsForSponsor(sponsorUserId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM v106_global_sponsorships
    WHERE sponsor_user_id = $1
    `,
    [sponsorUserId]
  );

  return result.rows[0].total;
}

function withDatabase(name, fn) {
  test(name, async (context) => {
    if (!pool) {
      context.skip(
        "initdb/pg_ctl indisponibles: tests PostgreSQL V10.6 ignorés."
      );
      return;
    }

    await fn();
  });
}

test.before(async () => {
  const externalDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL;

  if (externalDatabaseUrl) {
    process.env.DATABASE_URL =
      externalDatabaseUrl;
  } else {
    cluster = await startTemporaryPostgres();

    if (!cluster) {
      return;
    }

    process.env.DATABASE_URL =
      cluster.connectionString;
  }

  const connectionString =
    process.env.DATABASE_URL;

  pool = new Pool({
    connectionString
  });

  db = require("../config/db");
  migrationRunner = require("../db/migration-runner");
  v106Repository = require("../modules/v106/v106.repository");
});

test.after(async () => {
  if (db?.pool) {
    await db.pool.end();
  }

  if (pool) {
    await pool.end();
  }

  if (cluster) {
    await cluster.stop();
  }
});

test.beforeEach(async (context) => {
  if (!pool) {
    return;
  }

  await resetDatabase();
});

withDatabase("Test 1 - création/résolution du root", async () => {
  const root = await insertUser({
    isRoot: true,
    emailConfirmed: true
  });

  const resolvedBefore =
    await v106Repository.resolveRootUser();

  assert.equal(resolvedBefore.id, root.id);
  assert.equal(resolvedBefore.is_explicit, false);

  const resolvedAfter =
    await v106Repository.setRootUser(root.id);

  assert.equal(resolvedAfter.id, root.id);
  assert.equal(resolvedAfter.is_explicit, true);
});

withDatabase("Test 2 - sponsor valide", async () => {
  const sponsor = await insertUser();
  const child = await insertUser();

  const assignment =
    await v106Repository.assignGlobalSponsor({
      sponsorUserId: sponsor.id,
      childUserId: child.id,
      assignmentSource: "TEST_VALID_SPONSOR"
    });

  assert.equal(assignment.sponsor_user_id, sponsor.id);
  assert.equal(assignment.child_user_id, child.id);
  assert.equal(assignment.slot_no, 1);
});

withDatabase("Test 3 - un sponsor peut avoir 1 direct", async () => {
  const sponsor = await insertUser();
  const child = await insertUser();

  await v106Repository.assignGlobalSponsor({
    sponsorUserId: sponsor.id,
    childUserId: child.id
  });

  const assignments =
    await v106Repository.listGlobalSponsorAssignments(
      sponsor.id
    );

  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].slot_no, 1);
});

withDatabase("Test 4 - un sponsor peut avoir 2 directs", async () => {
  const sponsor = await insertUser();
  const child1 = await insertUser();
  const child2 = await insertUser();

  const first =
    await v106Repository.assignGlobalSponsor({
      sponsorUserId: sponsor.id,
      childUserId: child1.id
    });

  const second =
    await v106Repository.assignGlobalSponsor({
      sponsorUserId: sponsor.id,
      childUserId: child2.id
    });

  assert.equal(first.slot_no, 1);
  assert.equal(second.slot_no, 2);
});

withDatabase("Test 5 - le troisième direct est refusé", async () => {
  const sponsor = await insertUser();
  const child1 = await insertUser();
  const child2 = await insertUser();
  const child3 = await insertUser();

  await v106Repository.assignGlobalSponsor({
    sponsorUserId: sponsor.id,
    childUserId: child1.id
  });

  await v106Repository.assignGlobalSponsor({
    sponsorUserId: sponsor.id,
    childUserId: child2.id
  });

  await assert.rejects(
    () =>
      v106Repository.assignGlobalSponsor({
        sponsorUserId: sponsor.id,
        childUserId: child3.id
      }),
    /maximum of two directs/
  );
});

withDatabase("Test 6 - deux demandes concurrentes ne peuvent pas produire 3 directs", async () => {
  const sponsor = await insertUser();
  const child1 = await insertUser();
  const child2 = await insertUser();
  const child3 = await insertUser();

  const results = await Promise.allSettled([
    v106Repository.assignGlobalSponsor({
      sponsorUserId: sponsor.id,
      childUserId: child1.id
    }),
    v106Repository.assignGlobalSponsor({
      sponsorUserId: sponsor.id,
      childUserId: child2.id
    }),
    v106Repository.assignGlobalSponsor({
      sponsorUserId: sponsor.id,
      childUserId: child3.id
    })
  ]);

  const successes = results.filter(
    (result) => result.status === "fulfilled"
  );
  const failures = results.filter(
    (result) => result.status === "rejected"
  );

  assert.equal(successes.length, 2);
  assert.equal(failures.length, 1);
  assert.equal(
    await countAssignmentsForSponsor(sponsor.id),
    2
  );
});

withDatabase("Test 7 - phase initiale LEADER_LAUNCH", async () => {
  const root = await insertUser({
    isRoot: true,
    emailConfirmed: true
  });

  await v106Repository.setRootUser(root.id);

  const phaseState =
    await v106Repository.getPhaseState();

  assert.equal(
    phaseState.current_phase,
    "LEADER_LAUNCH"
  );
  assert.equal(phaseState.leader_count, 0);
});

withDatabase("Test 8 - transition 49 vers 50 sans double transition concurrente", async () => {
  const root = await insertUser({
    isRoot: true,
    emailConfirmed: true
  });

  await v106Repository.setRootUser(root.id);

  for (let index = 0; index < 49; index += 1) {
    await insertUser({
      sponsorId: root.id,
      isLeader: true,
      isPrelaunchLeader: true,
      emailConfirmed: true,
      linkActive: false
    });
  }

  const before =
    await v106Repository.getPhaseState();

  assert.equal(before.leader_count, 49);
  assert.equal(
    before.current_phase,
    "LEADER_LAUNCH"
  );

  await insertUser({
    sponsorId: root.id,
    isLeader: true,
    isPrelaunchLeader: true,
    emailConfirmed: true,
    linkActive: false
  });

  const results = await Promise.all([
    v106Repository.transitionToNormalOperationIfThresholdMet(
      "threshold_50_reached"
    ),
    v106Repository.transitionToNormalOperationIfThresholdMet(
      "threshold_50_reached"
    )
  ]);

  assert.equal(
    results.filter((result) => result.transitioned).length,
    1
  );

  const after =
    await v106Repository.getPhaseState();
  const transitions =
    await v106Repository.listPhaseTransitions();

  assert.equal(
    after.current_phase,
    "NORMAL_OPERATION"
  );
  assert.equal(after.leader_count, 50);
  assert.equal(transitions.length, 1);
});

withDatabase("Test 9 - rollback complet en cas d'échec", async () => {
  const sponsor = await insertUser();
  const child1 = await insertUser();
  const child2 = await insertUser();

  await assert.rejects(() =>
    db.withTransaction(async (client) => {
      await v106Repository.assignGlobalSponsor(
        {
          sponsorUserId: sponsor.id,
          childUserId: child1.id
        },
        { client }
      );

      await client.query(
        `
        INSERT INTO v106_global_sponsorships (
          sponsor_user_id,
          child_user_id,
          slot_no,
          assignment_source
        )
        VALUES ($1, $2, 1, 'FORCED_DUPLICATE_SLOT')
        `,
        [sponsor.id, child2.id]
      );
    })
  );

  assert.equal(
    await countAssignmentsForSponsor(sponsor.id),
    0
  );
});
