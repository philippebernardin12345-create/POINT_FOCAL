"use strict";

/**
 * v106-step1.test.js
 * Tests de la fondation V10.6 — Étape 1.
 *
 * Ces tests nécessitent une base PostgreSQL dédiée.
 * Ils sont ignorés proprement si TEST_DATABASE_URL n'est pas défini.
 *
 * Usage :
 *   TEST_DATABASE_URL=postgres://... npm test
 */

try { require("dotenv").config(); } catch (_) { /* dotenv optionnel */ }

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const SKIP = !process.env.TEST_DATABASE_URL;
const SKIP_MSG = "TEST_DATABASE_URL non défini — tests PostgreSQL ignorés";

if (SKIP) {
  test(SKIP_MSG, { skip: true }, () => {});
  // Sortir proprement sans exécuter le reste
  // (les blocs describe/test ci-dessous sont enregistrés de façon synchrone,
  //  mais node:test ne les exécutera pas si le processus se termine après).
  process.exit(0);
}

// ── Connexion dédiée à la base de test ──────────────────────────────────────
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: process.env.TEST_DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

const db = {
  query:           (...a)  => pool.query(...a),
  withTransaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await fn(client);
      await client.query("COMMIT");
      return r;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────
async function createUser(suffix) {
  const res = await db.query(
    `INSERT INTO users (id, email, whatsapp, password_hash, victory_expired)
     VALUES (gen_random_uuid(), $1, $2, 'x', FALSE)
     RETURNING id`,
    [`test_${suffix}@v106.test`, `+00000${suffix}`]
  );
  return res.rows[0].id;
}

async function setLeader(userId) {
  await db.query("UPDATE users SET is_leader = TRUE WHERE id = $1", [userId]);
}

async function cleanupTestData() {
  await db.query("DELETE FROM v106_phase_transition_events");
  await db.query("DELETE FROM v106_global_sponsorships");
  await db.query(
    "DELETE FROM v106_runtime_state WHERE singleton_id = 1"
  );
  await db.query("DELETE FROM users WHERE email LIKE 'test_%@v106.test'");

  // Réinitialiser le singleton
  await db.query(
    `INSERT INTO v106_runtime_state (singleton_id, phase, leader_count, leader_threshold, updated_at)
     VALUES (1, 'LEADER_LAUNCH', 0, 50, NOW())
     ON CONFLICT (singleton_id) DO UPDATE
       SET phase = 'LEADER_LAUNCH', leader_count = 0, leader_threshold = 50, root_user_id = NULL, updated_at = NOW()`
  );
}

// ── Suite de tests ────────────────────────────────────────────────────────────

before(async () => {
  await cleanupTestData();
});

after(async () => {
  await cleanupTestData();
  await pool.end();
});

// 1. Root ─────────────────────────────────────────────────────────────────────
test("1 — setRootUser persiste root_user_id dans le singleton", async () => {
  const rootId = await createUser("root_1");
  await db.query(
    `UPDATE v106_runtime_state SET root_user_id = $1, updated_at = NOW() WHERE singleton_id = 1`,
    [rootId]
  );
  const res = await db.query("SELECT root_user_id FROM v106_runtime_state WHERE singleton_id = 1");
  assert.equal(res.rows[0].root_user_id, rootId);
});

// 2. Sponsor valide ────────────────────────────────────────────────────────────
test("2 — assignation d'un sponsor valide (slot 1)", async () => {
  const sponsor = await createUser("sponsor_2");
  const child   = await createUser("child_2");
  const res = await db.query(
    "SELECT slot_no FROM v106_assign_global_sponsor($1, $2)",
    [sponsor, child]
  );
  assert.equal(res.rows[0].slot_no, 1);
});

// 3. Premier direct ───────────────────────────────────────────────────────────
test("3 — premier direct occupe le slot 1", async () => {
  const sponsor = await createUser("sponsor_3");
  const child   = await createUser("child_3");
  const res = await db.query(
    "SELECT slot_no FROM v106_assign_global_sponsor($1, $2)",
    [sponsor, child]
  );
  assert.equal(Number(res.rows[0].slot_no), 1);
});

// 4. Deuxième direct ──────────────────────────────────────────────────────────
test("4 — deuxième direct occupe le slot 2", async () => {
  const sponsor = await createUser("sponsor_4");
  const c1      = await createUser("child_4a");
  const c2      = await createUser("child_4b");
  await db.query("SELECT v106_assign_global_sponsor($1, $2)", [sponsor, c1]);
  const res = await db.query(
    "SELECT slot_no FROM v106_assign_global_sponsor($1, $2)",
    [sponsor, c2]
  );
  assert.equal(Number(res.rows[0].slot_no), 2);
});

// 5. Troisième direct refusé ───────────────────────────────────────────────────
test("5 — troisième direct est refusé (sponsor_full)", async () => {
  const sponsor = await createUser("sponsor_5");
  const c1      = await createUser("child_5a");
  const c2      = await createUser("child_5b");
  const c3      = await createUser("child_5c");
  await db.query("SELECT v106_assign_global_sponsor($1, $2)", [sponsor, c1]);
  await db.query("SELECT v106_assign_global_sponsor($1, $2)", [sponsor, c2]);
  await assert.rejects(
    () => db.query("SELECT v106_assign_global_sponsor($1, $2)", [sponsor, c3]),
    /sponsor_full/
  );
});

// 6. Concurrence — maximum 2 directs ──────────────────────────────────────────
test("6 — concurrence : exactement 2 slots assignés sur 5 tentatives simultanées", async () => {
  const sponsor = await createUser("sponsor_6");
  const children = await Promise.all(
    [1, 2, 3, 4, 5].map(i => createUser(`child_6_${i}`))
  );

  const results = await Promise.allSettled(
    children.map(c =>
      db.query("SELECT v106_assign_global_sponsor($1, $2)", [sponsor, c])
    )
  );

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed    = results.filter(r => r.status === "rejected").length;

  assert.equal(succeeded, 2, `Attendu 2 succès, obtenu ${succeeded}`);
  assert.equal(failed, 3,    `Attendu 3 échecs, obtenu ${failed}`);
});

// 7. Phase initiale ───────────────────────────────────────────────────────────
test("7 — phase initiale est LEADER_LAUNCH", async () => {
  const res = await db.query("SELECT phase FROM v106_runtime_state WHERE singleton_id = 1");
  assert.equal(res.rows[0].phase, "LEADER_LAUNCH");
});

// 8. 49 leaders => pas de transition ─────────────────────────────────────────
test("8 — 49 leaders => threshold_not_reached", async () => {
  // Nettoyage de la phase
  await db.query(
    "UPDATE v106_runtime_state SET phase = 'LEADER_LAUNCH', leader_count = 0, updated_at = NOW() WHERE singleton_id = 1"
  );
  await db.query("DELETE FROM v106_phase_transition_events");

  // Créer 49 leaders de test
  const leaders49 = await Promise.all(
    Array.from({ length: 49 }, (_, i) => createUser(`leader8_${i}`))
  );
  await Promise.all(leaders49.map(id => setLeader(id)));

  const res = await db.query("SELECT v106_transition_phase_to_normal_operation() AS r");
  assert.equal(res.rows[0].r, "threshold_not_reached");

  // Cleanup leaders
  await db.query("UPDATE users SET is_leader = FALSE WHERE email LIKE 'test_leader8_%@v106.test'");
});

// 9. 50 leaders => NORMAL_OPERATION ──────────────────────────────────────────
test("9 — 50 leaders => NORMAL_OPERATION", async () => {
  await db.query(
    "UPDATE v106_runtime_state SET phase = 'LEADER_LAUNCH', leader_count = 0, updated_at = NOW() WHERE singleton_id = 1"
  );
  await db.query("DELETE FROM v106_phase_transition_events");

  const leaders50 = await Promise.all(
    Array.from({ length: 50 }, (_, i) => createUser(`leader9_${i}`))
  );
  await Promise.all(leaders50.map(id => setLeader(id)));

  const res = await db.query("SELECT v106_transition_phase_to_normal_operation() AS r");
  assert.equal(res.rows[0].r, "transitioned");

  const state = await db.query("SELECT phase FROM v106_runtime_state WHERE singleton_id = 1");
  assert.equal(state.rows[0].phase, "NORMAL_OPERATION");

  // Cleanup
  await db.query("UPDATE users SET is_leader = FALSE WHERE email LIKE 'test_leader9_%@v106.test'");
});

// 10. Appels concurrents de transition => une seule transition ─────────────────
test("10 — appels concurrents : une seule transition enregistrée", async () => {
  await db.query(
    "UPDATE v106_runtime_state SET phase = 'LEADER_LAUNCH', leader_count = 0, updated_at = NOW() WHERE singleton_id = 1"
  );
  await db.query("DELETE FROM v106_phase_transition_events");

  const leaders = await Promise.all(
    Array.from({ length: 50 }, (_, i) => createUser(`leader10_${i}`))
  );
  await Promise.all(leaders.map(id => setLeader(id)));

  // 5 appels simultanés
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      db.query("SELECT v106_transition_phase_to_normal_operation() AS r")
    )
  );

  const successes = results.filter(r => r.status === "fulfilled");
  assert.ok(successes.length >= 1, "Au moins un appel doit réussir");

  const eventsRes = await db.query("SELECT COUNT(*) AS c FROM v106_phase_transition_events WHERE to_phase = 'NORMAL_OPERATION'");
  assert.equal(Number(eventsRes.rows[0].c), 1, "Une seule transition doit être journalisée");

  // Cleanup
  await db.query("UPDATE users SET is_leader = FALSE WHERE email LIKE 'test_leader10_%@v106.test'");
});

// 11. Rollback complet ─────────────────────────────────────────────────────────
test("11 — rollback : aucune donnée persistée si la transaction échoue", async () => {
  const sponsor = await createUser("sponsor_11");
  const child   = await createUser("child_11");

  await assert.rejects(
    () =>
      db.withTransaction(async (client) => {
        await client.query(
          "SELECT v106_assign_global_sponsor($1, $2)",
          [sponsor, child]
        );
        throw new Error("rollback forcé");
      }),
    /rollback forcé/
  );

  const res = await db.query(
    "SELECT COUNT(*) AS c FROM v106_global_sponsorships WHERE sponsor_user_id = $1",
    [sponsor]
  );
  assert.equal(Number(res.rows[0].c), 0, "Aucune assignation ne doit persister après rollback");
});
