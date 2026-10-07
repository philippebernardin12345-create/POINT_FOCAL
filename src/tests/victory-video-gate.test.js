"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const repository = {
  user: null,
  writes: 0,
  findUserWithSponsor: async () => repository.user,
  saveVictoryParentIdentifier: async (userId, identifier) => {
    repository.writes += 1;
    return { id: userId, victory_parent_identifier: identifier };
  },
  markVictoryAssigned: async (userId, startedAt, expiresAt) => {
    repository.writes += 1;
    return {
      id: userId,
      victory_started_at: startedAt,
      victory_expires_at: expiresAt
    };
  },
  saveVictoryPersonalLink: async (userId, link) => {
    repository.writes += 1;
    return { id: userId, victory_personal_link: link };
  },
  findUserByVictoryPersonalLink: async () => null
};

const opportunityService = {
  registerFollowMeLink: async () => {
    repository.writes += 1;
    return { id: "assignment-1" };
  }
};

const videoService = { completed: false, isVideoCompleted: async () => videoService.completed };
const opportunityEngine = {
  opportunity: null,
  getEntryOpportunity: async () => opportunityEngine.opportunity
};

function mockModule(request, exports) {
  const filename = require.resolve(request);
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports
  };
}

mockModule("../modules/victory/victory.repository", repository);
mockModule("../modules/opportunities/opportunities.service", opportunityService);
mockModule("../modules/video/video.service", videoService);
mockModule("../core/opportunity.engine", opportunityEngine);

const victoryService = require("../modules/victory/victory.service");

function reset() {
  repository.user = null;
  repository.writes = 0;
  videoService.completed = false;
  opportunityEngine.opportunity = null;
}

test("assignment skips video for an existing active Point Focal link with invitation code", async () => {
  reset();
  repository.user = {
    id: "user-1",
    link_active: true,
    invitation_code: "PF-LEADER",
    sponsor_user_id: "sponsor-1",
    sponsor_victory_link: "https://victoryautomatic.com/user/register/sponsor",
    status: "active"
  };

  const result = await victoryService.assignVictoryLink("user-1");

  assert.equal(result.source, "sponsor");
  assert.equal(result.victoryParentIdentifier, "sponsor");
  assert.equal(repository.writes, 2);
});

test("assignment still requires video when an active link has no invitation code", async () => {
  reset();
  repository.user = {
    id: "user-1",
    link_active: true,
    invitation_code: " ",
    status: "active"
  };

  await assert.rejects(
    victoryService.assignVictoryLink("user-1"),
    /vidéo obligatoire de 200 secondes/
  );
  assert.equal(repository.writes, 0);
});

test("assignment still requires video when the invitation code exists but the link is inactive", async () => {
  reset();
  repository.user = {
    id: "user-1",
    link_active: false,
    invitation_code: "PF-LEADER",
    status: "active"
  };

  await assert.rejects(
    victoryService.assignVictoryLink("user-1"),
    /vidéo obligatoire de 200 secondes/
  );
  assert.equal(repository.writes, 0);
});

test("assignment writes only after server video completion is confirmed", async () => {
  reset();
  videoService.completed = true;
  repository.user = {
    id: "user-1",
    sponsor_user_id: "sponsor-1",
    sponsor_victory_link: "https://victoryautomatic.com/user/register/sponsor",
    status: "active"
  };

  const result = await victoryService.assignVictoryLink("user-1");

  assert.equal(result.source, "sponsor");
  assert.equal(result.victoryParentIdentifier, "sponsor");
  assert.equal(repository.writes, 2);
});

test("personal-link endpoint rejects incomplete video before any registration or write", async () => {
  reset();
  repository.user = {
    id: "user-1",
    status: "active",
    victory_started_at: new Date(),
    victory_parent_identifier: "sponsor"
  };

  await assert.rejects(
    victoryService.saveVictoryPersonalLink(
      "user-1",
      "https://victoryautomatic.com/user/register/member"
    ),
    /vidéo obligatoire de 200 secondes/
  );
  assert.equal(repository.writes, 0);
});

test("personal-link endpoint skips video only for an existing active Point Focal link with invitation code", async () => {
  reset();
  opportunityEngine.opportunity = { id: "opportunity-1" };
  repository.user = {
    id: "user-1",
    status: "active",
    link_active: true,
    invitation_code: "PF-LEADER",
    victory_started_at: new Date(),
    victory_parent_identifier: "sponsor"
  };

  const result = await victoryService.saveVictoryPersonalLink(
    "user-1",
    "https://victoryautomatic.com/user/register/member"
  );

  assert.equal(
    result.victoryPersonalLink,
    "https://victoryautomatic.com/user/register/member"
  );
  assert.equal(result.opportunityId, "opportunity-1");
  assert.equal(repository.writes, 2);
});

test("video service trusts only a completed server state with at least 200 seconds", async () => {
  const servicePath = require.resolve("../modules/video/video.service");
  const repositoryPath = require.resolve("../modules/video/video.repository");
  const previousService = require.cache[servicePath];
  const previousRepository = require.cache[repositoryPath];
  let state = { is_completed: true, watched_seconds: 200 };
  const videoRepository = {
    findVideoStateByUserId: async () => state
  };

  try {
    mockModule("../modules/video/video.repository", videoRepository);
    delete require.cache[servicePath];
    const actualVideoService = require("../modules/video/video.service");

    assert.equal(await actualVideoService.isVideoCompleted("user-1"), true);
    state = { is_completed: true, watched_seconds: 199 };
    assert.equal(await actualVideoService.isVideoCompleted("user-1"), false);
    state = { is_completed: false, watched_seconds: 200 };
    assert.equal(await actualVideoService.isVideoCompleted("user-1"), false);
    state = null;
    assert.equal(await actualVideoService.isVideoCompleted("user-1"), false);
  } finally {
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
    if (previousRepository) require.cache[repositoryPath] = previousRepository;
    else delete require.cache[repositoryPath];
  }
});
