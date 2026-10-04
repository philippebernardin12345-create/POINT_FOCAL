const test = require("node:test");
const assert = require("node:assert/strict");

/*
 * S3 — Tests unitaires de la logique consolidée Roll-Up + FIFO 2.
 * Ces tests utilisent un client SQL minimal afin de verrouiller les invariants
 * métier sans dépendre d'une base distante.
 */

function loadV2WithRoot(root) {
  const runtimePath = require.resolve("../db/v106-runtime");
  const servicePath = require.resolve("../core/v2-rotation.service");
  const originalRuntime = require.cache[runtimePath];

  require.cache[runtimePath] = {
    id: runtimePath,
    filename: runtimePath,
    loaded: true,
    exports: { resolveRootUser: async () => root }
  };
  delete require.cache[servicePath];
  const service = require(servicePath);

  return {
    service,
    restore() {
      delete require.cache[servicePath];
      if (originalRuntime) require.cache[runtimePath] = originalRuntime;
      else delete require.cache[runtimePath];
    }
  };
}

function makeClient({ children = {}, confirmed = [], counts = {} }) {
  const confirmedSet = new Set(confirmed.map(([u, o]) => `${u}:${o}`));
  return {
    async query(sql, params) {
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

test("S3 - aucun FIFO2 sans inactivité confirmée de la racine dans l'opportunité", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({ children: { root: ["a"] } });
    await assert.rejects(loaded.service.getV2Parent("new", "oppA", { client }), /FIFO2_ROOT_INACTIVITY_NOT_CONFIRMED/);
  } finally { loaded.restore(); }
});

test("S3 - confirmation dans A ne rend pas la racine inactive dans B", async () => {
  const loaded = loadV2WithRoot({ id: "root" });
  try {
    const client = makeClient({ confirmed: [["root", "oppA"]] });
    await assert.rejects(loaded.service.getV2Parent("new", "oppB", { client }), /FIFO2_ROOT_INACTIVITY_NOT_CONFIRMED/);
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
