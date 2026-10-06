const test = require("node:test");
const assert = require("node:assert/strict");

const registry = require("../modules/opportunities/opportunities.registry");

function repository(rows) {
  return {
    async findAllActive() {
      return rows;
    }
  };
}

function dbOpportunity(overrides = {}) {
  return {
    id: "opportunity-1",
    slug: "opportunity-1",
    name: "Opportunity 1",
    status: "ACTIVE",
    is_available: true,
    priority: 10,
    is_entry: true,
    generates_link: false,
    ...overrides
  };
}

test.beforeEach(() => {
  registry.modules.clear();
  registry.databaseSlugs.clear();
});

test.after(() => {
  registry.modules.clear();
  registry.databaseSlugs.clear();
});

test("S7 registry - met à jour les propriétés d'une opportunité lors d'un nouveau chargement DB", async () => {
  await registry.loadFromDatabase(repository([dbOpportunity()]));
  await registry.loadFromDatabase(repository([
    dbOpportunity({ is_available: false, priority: 2 })
  ]));

  const updated = registry.get("opportunity-1");

  assert.equal(updated.isAvailable, false);
  assert.equal(updated.priority, 2);
});

test("S7 registry - retire les opportunités DB inactives sans supprimer les modules manuels", async () => {
  registry.register("manual-opportunity", {
    id: "manual-1",
    name: "Manual opportunity",
    status: "active",
    isActive: true,
    isAvailable: true,
    priority: 5,
    isEntry: true
  });

  await registry.loadFromDatabase(repository([dbOpportunity()]));
  await registry.loadFromDatabase(repository([]));

  assert.equal(registry.has("opportunity-1"), false);
  assert.equal(registry.has("manual-opportunity"), true);
});
