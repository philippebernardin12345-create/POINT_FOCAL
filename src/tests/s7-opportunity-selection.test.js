const test = require("node:test");
const assert = require("node:assert/strict");

const registry = require("../modules/opportunities/opportunities.registry");
const userRepositoryPath = require.resolve("../modules/users/users.repository");
const enginePath = require.resolve("../core/opportunity.engine");
const originalUserRepository = require.cache[userRepositoryPath];
const originalEngine = require.cache[enginePath];

require.cache[userRepositoryPath] = {
  id: userRepositoryPath,
  filename: userRepositoryPath,
  loaded: true,
  exports: {
    async findUserById(id) {
      return { id };
    }
  }
};

delete require.cache[enginePath];
const engine = require("../core/opportunity.engine");

function loadOpportunities(opportunities) {
  registry.modules.clear();
  for (const opportunity of opportunities) {
    registry.register(opportunity.slug, opportunity);
  }
}

function opportunity(overrides) {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    name: overrides.slug,
    status: "active",
    isAvailable: true,
    priority: 100,
    isEntry: false,
    canGeneratePointFocalLink: false,
    ...overrides
  };
}

test.after(() => {
  registry.modules.clear();
  delete require.cache[enginePath];
  if (originalEngine) require.cache[enginePath] = originalEngine;
  if (originalUserRepository) require.cache[userRepositoryPath] = originalUserRepository;
  else delete require.cache[userRepositoryPath];
});

test("S7 - choisit l'opportunité d'entrée active et disponible la plus prioritaire", async () => {
  loadOpportunities([
    opportunity({ slug: "entry-later", id: "entry-later", isEntry: true, priority: 20 }),
    opportunity({ slug: "entry-first", id: "entry-first", isEntry: true, priority: 2 }),
    opportunity({ slug: "entry-unavailable", id: "entry-unavailable", isEntry: true, priority: 1, isAvailable: false }),
    opportunity({ slug: "entry-inactive", id: "entry-inactive", isEntry: true, priority: 0, status: "inactive" }),
    opportunity({ slug: "not-entry", id: "not-entry", priority: 0 })
  ]);

  const selected = await engine.getEntryOpportunity({ userId: "user-1" });

  assert.equal(selected.id, "entry-first");
});

test("S7 - choisit le générateur actif et disponible le plus prioritaire", async () => {
  loadOpportunities([
    opportunity({ slug: "generator-later", id: "generator-later", canGeneratePointFocalLink: true, priority: 10 }),
    opportunity({ slug: "generator-first", id: "generator-first", canGeneratePointFocalLink: true, priority: 3 }),
    opportunity({ slug: "generator-unavailable", id: "generator-unavailable", canGeneratePointFocalLink: true, priority: 1, isAvailable: false }),
    opportunity({ slug: "generator-inactive", id: "generator-inactive", canGeneratePointFocalLink: true, priority: 0, status: "inactive" }),
    opportunity({ slug: "not-generator", id: "not-generator", priority: 0 })
  ]);

  const selected = await engine.getGeneratorOpportunity({ userId: "user-1" });

  assert.equal(selected.id, "generator-first");
});

test("S7 - renvoie l'étape suivante dans l'ordre de priorité parmi les opportunités disponibles", async () => {
  loadOpportunities([
    opportunity({ slug: "step-c", id: "step-c", priority: 30 }),
    opportunity({ slug: "step-a", id: "step-a", priority: 10 }),
    opportunity({ slug: "step-paused", id: "step-paused", priority: 15, status: "inactive" }),
    opportunity({ slug: "step-b", id: "step-b", priority: 20 }),
    opportunity({ slug: "step-unavailable", id: "step-unavailable", priority: 25, isAvailable: false })
  ]);

  const selected = await engine.getNextOpportunity("user-1", "step-a");

  assert.equal(selected.id, "step-b");
});

test("S7 - recharge les changements de disponibilité depuis la base", async () => {
  registry.modules.clear();

  const initialOpportunity = {
    id: "opportunity-1",
    slug: "opportunity-1",
    name: "Opportunity 1",
    status: "ACTIVE",
    is_available: true,
    priority: 10,
    is_entry: true,
    generates_link: false
  };
  const updatedOpportunity = {
    ...initialOpportunity,
    is_available: false,
    priority: 1
  };

  await registry.loadFromDatabase({
    async findAllActive() {
      return [initialOpportunity];
    }
  });
  await registry.loadFromDatabase({
    async findAllActive() {
      return [updatedOpportunity];
    }
  });

  const selected = await engine.getEntryOpportunity();

  assert.equal(selected, null);
});

test("S7 - sans opportunité courante reconnue, repart de la première disponible", async () => {
  loadOpportunities([
    opportunity({ slug: "step-b", id: "step-b", priority: 20 }),
    opportunity({ slug: "step-a", id: "step-a", priority: 10 })
  ]);

  const selected = await engine.getNextOpportunity("user-1", "unknown-step");

  assert.equal(selected.id, "step-a");
});
