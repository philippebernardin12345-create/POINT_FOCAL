const test = require("node:test");
const assert = require("node:assert/strict");

const statements = [];
const dbPath = require.resolve("../config/db");
const repositoryPath = require.resolve("../modules/opportunities/opportunities.repository");
const originalDb = require.cache[dbPath];
const originalRepository = require.cache[repositoryPath];

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    async query(sql, values) {
      statements.push({ sql, values });
      return { rows: [{ id: "opportunity-1" }] };
    }
  }
};
delete require.cache[repositoryPath];
const repository = require("../modules/opportunities/opportunities.repository");

test.after(() => {
  delete require.cache[repositoryPath];
  if (originalRepository) require.cache[repositoryPath] = originalRepository;
  if (originalDb) require.cache[dbPath] = originalDb;
  else delete require.cache[dbPath];
});

test("opportunity repository writes only schema-backed fields and maps availability to status", async () => {
  await repository.create({
    name: "Entry",
    slug: "entry",
    isAvailable: false,
    position: 2,
    priority: 1,
    isEntry: true,
    canGeneratePointFocalLink: true
  });
  await repository.update("opportunity-1", {
    isAvailable: true,
    position: 3
  });

  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /position/);
  assert.match(statements[0].sql, /generates_link/);
  assert.match(statements[0].sql, /status/);
  assert.equal(statements[0].values[3], "inactive");
  assert.match(statements[1].sql, /status = \$1/);
  assert.match(statements[1].sql, /position = \$2/);
  assert.deepEqual(statements[1].values, ["active", 3, "opportunity-1"]);

  for (const { sql } of statements) {
    assert.doesNotMatch(
      sql,
      /\b(is_available|depends_on|requires_provision|provision_amount|provision_message|registration_url)\b/i
    );
  }
});

test("opportunity repository rejects dependency fields absent from the schema", async () => {
  statements.length = 0;
  await assert.rejects(
    repository.update("opportunity-1", { dependsOn: "previous-opportunity" }),
    /dependsOn/
  );
  assert.equal(statements.length, 0);
});
