const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const {
  checkVictoryAutomaticEligibility
} = require("../modules/victory-world/victory-world-eligibility");

const fixedNow = new Date("2026-10-07T10:00:00.000Z");

test("Victory World requires a verified Victory Automatic completion", () => {
  const result = checkVictoryAutomaticEligibility({
    status: "active",
    victory_personal_link: null
  }, fixedNow);

  assert.equal(result.eligible, false);
  assert.match(result.reason, /Victory Automatic/);
});

test("prelaunch Point Focal link does not unlock Victory World", () => {
  for (const user of [
    {
      status: "active",
      victory_personal_link: "https://victoryautomatic.com/user/register/member",
      link_active: false,
      invitation_code: "ABCD1000"
    },
    {
      status: "active",
      victory_personal_link: "https://victoryautomatic.com/user/register/member",
      link_active: true,
      invitation_code: null
    }
  ]) {
    const result = checkVictoryAutomaticEligibility(user, fixedNow);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /Victory Automatic/);
  }
});

test("an already admitted Victory World account keeps access without a new payment check", () => {
  const result = checkVictoryAutomaticEligibility({
    status: "active",
    victory_world_status: "validated",
    victory_world_link: "https://victoryworld.club/member"
  }, fixedNow);

  assert.deepEqual(result, { eligible: true, reason: null });
});

test("Victory World rejects an expired Victory Automatic account", () => {
  for (const user of [
    {
      status: "active",
      victory_personal_link: "https://victoryautomatic.com/user/register/member",
      link_active: true,
      invitation_code: "ABCD1000",
      victory_expired: true
    },
    {
      status: "EXPIRED",
      victory_personal_link: "https://victoryautomatic.com/user/register/member",
      link_active: true,
      invitation_code: "ABCD1000"
    },
    {
      status: "active",
      victory_personal_link: "https://victoryautomatic.com/user/register/member",
      link_active: true,
      invitation_code: "ABCD1000",
      victory_expires_at: "2026-10-07T09:59:59.000Z"
    }
  ]) {
    const result = checkVictoryAutomaticEligibility(user, fixedNow);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /expiré/);
  }
});

test("Victory World accepts a completed, non-expired Victory Automatic account", () => {
  const result = checkVictoryAutomaticEligibility({
    status: "active",
    victory_personal_link: "https://victoryautomatic.com/user/register/member",
    link_active: true,
    invitation_code: "ABCD1000",
    victory_expired: false,
    victory_expires_at: "2026-10-08T09:59:59.000Z"
  }, fixedNow);

  assert.deepEqual(result, { eligible: true, reason: null });
});

test("assignSponsor and saveLink enforce eligibility before writes", async () => {
  const repositoryMock = {
    findUserById: async () => ({
      id: "user-1",
      status: "active",
      victory_personal_link: null
    }),
    findUserByVictoryWorldLink: async () => {
      throw new Error("Unexpected sponsor lookup");
    },
    saveAssignedVictoryWorldLink: async () => {
      throw new Error("Unexpected assignment write");
    }
  };

  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (
      parent &&
      parent.filename.endsWith("/victory-world.service.js") &&
      request === "./victory-world.repository"
    ) {
      return repositoryMock;
    }
    if (
      parent &&
      parent.filename.endsWith("/victory-world.service.js") &&
      request === "../../core/opportunity.engine"
    ) {
      return {
        getOpportunityBySlug: () => null,
        getNextOpportunity: async () => null
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let service;
  try {
    service = require("../modules/victory-world/victory-world.service");
  } finally {
    Module._load = originalLoad;
  }

  await assert.rejects(
    service.assignSponsor("user-1"),
    /Victory Automatic/
  );
  await assert.rejects(
    service.saveLink("user-1", {
      victoryWorldLink: "https://victoryworld.club/member"
    }),
    /Victory Automatic/
  );
});
