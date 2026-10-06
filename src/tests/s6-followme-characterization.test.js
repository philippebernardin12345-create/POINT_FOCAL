const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function loadFollowMe({ joinedInOpportunity }) {
  const modulePaths = [
    "../config/db",
    "../modules/users/users.repository",
    "./opportunity.engine",
    "./rollup.service",
    "../utils/logger",
    "./v2-rotation.service",
    "../db/v106-runtime",
    "../utils/validators"
  ].map((request) => require.resolve(path.resolve(__dirname, "../core", request)));
  const originals = new Map(modulePaths.map((path) => [path, require.cache[path]]));
  const writes = [];
  const rollupCalls = [];
  const dbClient = {
    async query(sql, params = []) {
      writes.push({ sql, params });
      if (/^\s*INSERT INTO user_opportunities/i.test(sql)) {
        return { rows: [{ id: "uo-created", user_id: params[0], opportunity_id: params[1], sponsor_user_id: params[5] }] };
      }
      if (/^\s*UPDATE user_opportunities/i.test(sql)) {
        return { rows: [{ id: "uo-rolled", user_id: params[3], opportunity_id: params[4], referral_link: params[0] }] };
      }
      throw new Error(`Unexpected transactional SQL: ${sql}`);
    }
  };
  const db = {
    async query() { return { rows: [] }; },
    async withTransaction(callback) { return callback(dbClient); }
  };
  const mocks = [
    { exports: db },
    { exports: {
      async findUserById(id) { return { id, sponsor_id: "structural-sponsor" }; },
      async findUserByInvitationCode() { return null; }
    } },
    { exports: {
      async getOpportunityById(id) { return { id, status: "active", isAvailable: true, requiresSponsorValidation: false, allowedDomains: ["example.com"] }; },
      getOpportunityBySlug() { return null; }
    } },
    { exports: {
      async hasUserJoinedOpportunity(sponsorId, opportunityId) { return joinedInOpportunity(sponsorId, opportunityId); },
      async applyRollup(userId, opportunityId, options) {
        rollupCalls.push({ userId, opportunityId, hasTransactionClient: Boolean(options.client) });
        return { action: "rollup", rollupApplied: true };
      },
      async isRollupNeeded() { return false; },
      async addUserToOpportunity() { throw new Error("Unexpected direct placement helper call"); }
    } },
    { exports: { logger: { error() {}, warn() {}, info() {} } } },
    { exports: { async isConfirmedInactive() { return false; } } },
    { exports: { async resolveRootUser() { return { id: "root-user" }; } } },
    { exports: { isValidUrl(value) { try { new URL(value); return true; } catch { return false; } } } }
  ];

  modulePaths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: mocks[index].exports };
  });
  const enginePath = require.resolve("../core/followme.engine");
  const originalEngine = require.cache[enginePath];
  delete require.cache[enginePath];
  const engine = require("../core/followme.engine");

  return {
    engine,
    writes,
    rollupCalls,
    restore() {
      delete require.cache[enginePath];
      if (originalEngine) require.cache[enginePath] = originalEngine;
      for (const [path, original] of originals) {
        if (original) require.cache[path] = original;
        else delete require.cache[path];
      }
    }
  };
}

test("S6 - le placement Follow Me reste propre à l'opportunité et ne change pas le sponsor structurel", async () => {
  const loaded = loadFollowMe({ joinedInOpportunity: (_sponsorId, opportunityId) => opportunityId === "opp-a" });
  try {
    const result = await loaded.engine.registerUserLink({
      userId: "member-a",
      opportunityId: "opp-a",
      referralLink: "https://example.com/ref/member-a",
      sponsorId: "sponsor-present-in-a"
    });

    assert.equal(result.success, true);
    assert.equal(result.action, "created");
    assert.equal(result.data.sponsor_user_id, "sponsor-present-in-a");
    assert.equal(loaded.rollupCalls.length, 0);
    assert.equal(loaded.writes.length, 1);
    assert.match(loaded.writes[0].sql, /INSERT INTO user_opportunities/i);
    assert.doesNotMatch(loaded.writes.map((entry) => entry.sql).join("\n"), /\b(?:UPDATE|INSERT|DELETE)\s+(?:public\.)?users\b/i);
  } finally {
    loaded.restore();
  }
});

test("S6 - l'absence du sponsor dans B déclenche le relais uniquement pour B", async () => {
  const loaded = loadFollowMe({ joinedInOpportunity: (_sponsorId, opportunityId) => opportunityId === "opp-a" });
  try {
    const opportunityA = await loaded.engine.registerUserLink({
      userId: "member-a",
      opportunityId: "opp-a",
      referralLink: "https://example.com/ref/member-a",
      sponsorId: "shared-sponsor"
    });
    const opportunityB = await loaded.engine.registerUserLink({
      userId: "member-b",
      opportunityId: "opp-b",
      referralLink: "https://example.com/ref/member-b",
      sponsorId: "shared-sponsor"
    });

    assert.equal(opportunityA.action, "created");
    assert.equal(opportunityA.data.sponsor_user_id, "shared-sponsor");
    assert.equal(opportunityB.action, "rollup");
    assert.equal(opportunityB.rollupApplied, true);
    assert.deepEqual(loaded.rollupCalls, [{ userId: "member-b", opportunityId: "opp-b", hasTransactionClient: true }]);
    assert.doesNotMatch(loaded.writes.map((entry) => entry.sql).join("\n"), /\b(?:UPDATE|INSERT|DELETE)\s+(?:public\.)?users\b/i);
  } finally {
    loaded.restore();
  }
});
