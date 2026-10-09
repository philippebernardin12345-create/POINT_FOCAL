const test = require("node:test");
const assert = require("node:assert/strict");

const dbPath = require.resolve("../config/db");
const repositoryPath = require.resolve("../modules/opportunities/opportunities.repository");
const originalDb = require.cache[dbPath];
const originalRepository = require.cache[repositoryPath];
const rows = [
  {
    id: "victory-automatic",
    name: "Victory Automatic",
    position: 1,
    user_opportunity_status: "active"
  },
  {
    id: "victory-world",
    name: "Victory World",
    position: 2,
    user_opportunity_status: "active"
  }
];
let calls = [];

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows };
    }
  }
};
delete require.cache[repositoryPath];

const repository = require("../modules/opportunities/opportunities.repository");

test("S7 - preserves recorded opportunity memberships during prelaunch link inactivity", async () => {
  calls = [];

  const result = await repository.findActiveForUser("user-42");

  assert.deepEqual(result, rows);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["user-42"]);
  assert.match(calls[0].sql, /LEFT JOIN user_opportunities uo/i);
  assert.match(calls[0].sql, /uo\.user_id = \$1/i);
  assert.match(calls[0].sql, /UPPER\(o\.status\) = 'ACTIVE'/i);
  assert.match(calls[0].sql, /CASE[\s\S]*user_opportunity_status/i);
  assert.match(calls[0].sql, /LEFT JOIN users u/i);
  assert.match(calls[0].sql, /u\.link_active/i);
  assert.match(calls[0].sql, /o\.slug = 'victory-automatic'/i);
  assert.doesNotMatch(calls[0].sql, /o\.slug IN \('victory-automatic', 'victory-world'\)/i);
  assert.match(calls[0].sql, /ORDER BY o\.position ASC NULLS LAST/i);
});

test.after(() => {
  delete require.cache[repositoryPath];
  if (originalRepository) require.cache[repositoryPath] = originalRepository;
  if (originalDb) require.cache[dbPath] = originalDb;
  else delete require.cache[dbPath];
});
