const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function loadModule(modulePath, mocks = {}) {
  const resolvedModule = require.resolve(modulePath);
  const baseDir = path.dirname(resolvedModule);
  const originals = [];

  for (const [request, exports] of Object.entries(mocks)) {
    const resolvedDependency = require.resolve(request, {
      paths: [baseDir]
    });

    originals.push([
      resolvedDependency,
      require.cache[resolvedDependency]
    ]);

    require.cache[resolvedDependency] = {
      id: resolvedDependency,
      filename: resolvedDependency,
      loaded: true,
      exports
    };
  }

  delete require.cache[resolvedModule];

  try {
    return require(resolvedModule);
  } finally {
    delete require.cache[resolvedModule];

    for (const [resolvedDependency, original] of originals) {
      if (original) {
        require.cache[resolvedDependency] = original;
      } else {
        delete require.cache[resolvedDependency];
      }
    }
  }
}

test("Auth 1 - inscription avec code valide", async () => {
  let sentEmail = null;

  const authService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.service.js",
    {
      "bcryptjs": {
        hash: async () => "hash"
      },
      "./auth.repository": {
        findUserByEmail: async () => null,
        findUserByInvitationCode: async () => ({
          id: "sponsor-1"
        }),
        getActiveCampaign: async () => ({
          id: "campaign-1"
        }),
        createUser: async (payload) => ({
          id: "user-1",
          email: payload.email,
          sponsor_id: payload.sponsorId,
          invitation_code: "USER1001"
        }),
        saveEmailOtp: async () => ({})
      },
      "../../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../../db/v106-runtime": {
        resolveRootUser: async () => null
      },
      "../../config/jwt": {
        signToken: () => "token"
      },
      "../../config/email": {
        sendEmail: async (payload) => {
          sentEmail = payload;
        }
      },
      "../../utils/codeGenerator": {
        isValidInvitationCode: () => true,
        normalizeInvitationCode: (value) =>
          String(value || "").trim().toUpperCase()
      }
    }
  );

  const result = await authService.register({
    email: "demo@example.com",
    whatsapp: "123",
    password: "secret",
    confirmPassword: "secret",
    invitationCode: "abcd1001"
  });

  assert.equal(result.sponsorAssignment, "personal");
  assert.equal(result.user.sponsor_id, "sponsor-1");
  assert.equal(sentEmail.to, "demo@example.com");
});

test("Auth 2 - inscription avec code invalide", async () => {
  const authService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.service.js",
    {
      "bcryptjs": {
        hash: async () => "hash"
      },
      "./auth.repository": {
        findUserByEmail: async () => null
      },
      "../../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../../db/v106-runtime": {
        resolveRootUser: async () => null
      },
      "../../config/jwt": {
        signToken: () => "token"
      },
      "../../config/email": {
        sendEmail: async () => {}
      },
      "../../utils/codeGenerator": {
        isValidInvitationCode: () => false,
        normalizeInvitationCode: (value) =>
          String(value || "").trim().toUpperCase()
      }
    }
  );

  await assert.rejects(
    authService.register({
      email: "demo@example.com",
      whatsapp: "123",
      password: "secret",
      confirmPassword: "secret",
      invitationCode: "bad"
    }),
    /Code d'invitation invalide/
  );
});

test("Auth 3 - génération d'un code personnel unique", async () => {
  let insertAttempts = 0;

  const authRepository = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.repository.js",
    {
      "../../config/db": {
        query: async (_text, params) => {
          if (/SELECT 1\s+FROM users\s+WHERE invitation_code/.test(_text)) {
            return { rows: [] };
          }

          insertAttempts += 1;

          if (insertAttempts === 1) {
            const error = new Error("duplicate key");
            error.code = "23505";
            error.constraint = "users_invitation_code_key";
            throw error;
          }

          return {
            rows: [{
              id: "user-1",
              email: params[0],
              invitation_code: params[7]
            }]
          };
        }
      },
      "../../utils/codeGenerator": {
        generateInvitationCode: () =>
          insertAttempts === 0 ? "ABCD1001" : "EFGH1002",
        normalizeInvitationCode: (value) =>
          String(value || "").trim().toUpperCase()
      }
    }
  );

  const user = await authRepository.createUser({
    email: "demo@example.com",
    whatsapp: "123",
    passwordHash: "hash",
    language: "fr",
    status: "pending",
    sponsorId: "sponsor-1",
    campaignId: "campaign-1"
  });

  assert.equal(user.invitation_code, "EFGH1002");
  assert.equal(insertAttempts, 2);
});

test("Auth 4 - OTP valide", async () => {
  const authService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.service.js",
    {
      "bcryptjs": {
        hash: async () => "hash",
        compare: async () => true
      },
      "./auth.repository": {
        confirmEmailByOtp: async () => ({
          id: "user-1",
          email: "demo@example.com",
          is_root: false,
          is_leader: true,
          is_prelaunch_leader: true
        }),
        activatePrelaunchLeadersIfLimitReached: async () => ({
          activated: true,
          activatedCount: 1
        })
      },
      "../../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../../db/v106-runtime": {
        assignNextGlobalSponsor: async () => ({
          sponsor_user_id: "root-1",
          child_user_id: "user-1",
          slot_no: 1
        }),
        transitionPhaseToNormalOperation: async () => ({
          phase: "LEADER_LAUNCH",
          leader_count: 1,
          leader_threshold: 50,
          transitioned: false
        })
      },
      "../../config/jwt": {
        signToken: () => "token"
      },
      "../../config/email": {
        sendEmail: async () => {}
      },
      "../../utils/codeGenerator": {
        isValidInvitationCode: () => true,
        normalizeInvitationCode: (value) => value
      }
    }
  );

  const result = await authService.confirmOtp({
    email: "demo@example.com",
    otp: "123456"
  });

  assert.equal(result.v106Phase, "LEADER_LAUNCH");
  assert.equal(result.globalSponsor.sponsor_user_id, "root-1");
});

test("Auth 5 - OTP invalide", async () => {
  const authService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.service.js",
    {
      "bcryptjs": {
        hash: async () => "hash"
      },
      "./auth.repository": {
        confirmEmailByOtp: async () => null
      },
      "../../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../../db/v106-runtime": {
        transitionPhaseToNormalOperation: async () => ({
          phase: "LEADER_LAUNCH"
        })
      },
      "../../config/jwt": {
        signToken: () => "token"
      },
      "../../config/email": {
        sendEmail: async () => {}
      },
      "../../utils/codeGenerator": {
        isValidInvitationCode: () => true,
        normalizeInvitationCode: (value) => value
      }
    }
  );

  await assert.rejects(
    authService.confirmOtp({
      email: "demo@example.com",
      otp: "000000"
    }),
    /Code OTP invalide ou expiré/
  );
});

test("FIFO 11 - premier sponsor disponible choisi", async () => {
  const authService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.service.js",
    {
      "bcryptjs": {
        hash: async () => "hash"
      },
      "./auth.repository": {
        findUserByEmail: async () => null,
        findOldestAvailableSponsorForFifo: async () => ({
          id: "fifo-1"
        }),
        getActiveCampaign: async () => ({
          id: "campaign-1"
        }),
        createUser: async (payload) => ({
          id: "user-1",
          sponsor_id: payload.sponsorId,
          email: payload.email
        }),
        saveEmailOtp: async () => ({})
      },
      "../../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "../../config/jwt": {
        signToken: () => "token"
      },
      "../../config/email": {
        sendEmail: async () => {}
      },
      "../../utils/codeGenerator": {
        isValidInvitationCode: () => true,
        normalizeInvitationCode: (value) =>
          String(value || "").trim().toUpperCase()
      }
    }
  );

  const result = await authService.register({
    email: "fifo@example.com",
    whatsapp: "123",
    password: "secret",
    confirmPassword: "secret"
  });

  assert.equal(result.sponsorAssignment, "fifo");
  assert.equal(result.user.sponsor_id, "fifo-1");
});

test("FIFO 14 - sponsor suivant choisi quand le précédent est plein", async () => {
  const authService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/modules/auth/auth.service.js",
    {
      "bcryptjs": {
        hash: async () => "hash"
      },
      "./auth.repository": {
        findUserByEmail: async () => null,
        findOldestAvailableSponsorForFifo: async () => ({
          id: "fifo-2"
        }),
        getActiveCampaign: async () => ({
          id: "campaign-1"
        }),
        createUser: async (payload) => ({
          id: "user-2",
          sponsor_id: payload.sponsorId,
          email: payload.email
        }),
        saveEmailOtp: async () => ({})
      },
      "../../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "../../config/jwt": {
        signToken: () => "token"
      },
      "../../config/email": {
        sendEmail: async () => {}
      },
      "../../utils/codeGenerator": {
        isValidInvitationCode: () => true,
        normalizeInvitationCode: (value) =>
          String(value || "").trim().toUpperCase()
      }
    }
  );

  const result = await authService.register({
    email: "next@example.com",
    whatsapp: "123",
    password: "secret",
    confirmPassword: "secret"
  });

  assert.equal(result.user.sponsor_id, "fifo-2");
});

test("Follow Me 16 - sponsor réel conservé", async () => {
  let capturedOptions = null;

  const followmeEngine = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/followme.engine.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../modules/followme/followme.repository": {
        findUserById: async () => ({
          id: "user-1",
          sponsor_id: "real-sponsor"
        }),
        findUserOpportunity: async () => null,
        findUserByLink: async () => null
      },
      "../modules/users/users.repository": {
        findUserByInvitationCode: async () => ({
          id: "extracted-sponsor"
        })
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1",
          status: "active",
          isAvailable: true
        }),
        getOpportunityBySlug: () => null
      },
      "./rollup.service": {
        applyRollup: async (_userId, _opportunityId, options) => {
          capturedOptions = options;
          return {
            sponsorId: "placement-parent",
            rollupApplied: false,
            data: {
              sponsor_user_id: "placement-parent"
            }
          };
        }
      },
      "../utils/logger": {
        logger: {
          error: () => {},
          warn: () => {}
        }
      },
      "../utils/validators": {
        isValidUrl: () => true
      }
    }
  );

  await followmeEngine.registerUserLink({
    userId: "user-1",
    opportunityId: "opp-1",
    referralLink: "https://example.com/register?ref=CODE1001"
  });

  assert.equal(capturedOptions.requestedSponsorId, "extracted-sponsor");
});

test("Follow Me 17 - parent d'opportunité correctement enregistré", async () => {
  const followmeEngine = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/followme.engine.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../modules/followme/followme.repository": {
        findUserById: async () => ({
          id: "user-1",
          sponsor_id: "real-sponsor"
        }),
        findUserOpportunity: async () => null,
        findUserByLink: async () => null
      },
      "../modules/users/users.repository": {
        findUserByInvitationCode: async () => null
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1",
          status: "active",
          isAvailable: true
        }),
        getOpportunityBySlug: () => null
      },
      "./rollup.service": {
        applyRollup: async () => ({
          sponsorId: "parent-1",
          rollupApplied: false,
          data: {
            sponsor_user_id: "parent-1"
          }
        })
      },
      "../utils/logger": {
        logger: {
          error: () => {},
          warn: () => {}
        }
      },
      "../utils/validators": {
        isValidUrl: () => true
      }
    }
  );

  const result = await followmeEngine.registerUserLink({
    userId: "user-1",
    opportunityId: "opp-1",
    referralLink: "https://example.com/register"
  });

  assert.equal(result.data.sponsor_user_id, "parent-1");
});

test("Follow Me 18 - lien Follow Me valide", async () => {
  const followmeEngine = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/followme.engine.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../modules/followme/followme.repository": {
        findUserById: async () => ({
          id: "user-1",
          sponsor_id: "real-sponsor"
        }),
        findUserOpportunity: async () => null,
        findUserByLink: async () => null
      },
      "../modules/users/users.repository": {
        findUserByInvitationCode: async () => null
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1",
          status: "active",
          isAvailable: true
        }),
        getOpportunityBySlug: () => null
      },
      "./rollup.service": {
        applyRollup: async () => ({
          sponsorId: "parent-1",
          rollupApplied: false,
          data: {
            sponsor_user_id: "parent-1"
          }
        })
      },
      "../utils/logger": {
        logger: {
          error: () => {},
          warn: () => {}
        }
      },
      "../utils/validators": {
        isValidUrl: () => true
      }
    }
  );

  const result = await followmeEngine.registerUserLink({
    userId: "user-1",
    opportunityId: "opp-1",
    referralLink: "https://example.com/register"
  });

  assert.equal(result.success, true);
  assert.equal(result.rollupApplied, false);
});

test("Follow Me 19 - lien Follow Me invalide", async () => {
  const followmeEngine = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/followme.engine.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({})
      },
      "../modules/followme/followme.repository": {
        findUserById: async () => ({
          id: "user-1",
          sponsor_id: "real-sponsor"
        }),
        findUserOpportunity: async () => null,
        findUserByLink: async () => null
      },
      "../modules/users/users.repository": {
        findUserByInvitationCode: async () => null
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1",
          status: "active",
          isAvailable: true
        }),
        getOpportunityBySlug: () => null
      },
      "./rollup.service": {
        applyRollup: async () => ({
          sponsorId: "parent-1",
          rollupApplied: false,
          data: {
            sponsor_user_id: "parent-1"
          }
        })
      },
      "../utils/logger": {
        logger: {
          error: () => {},
          warn: () => {}
        }
      },
      "../utils/validators": {
        isValidUrl: () => false
      }
    }
  );

  await assert.rejects(
    followmeEngine.registerUserLink({
      userId: "user-1",
      opportunityId: "opp-1",
      referralLink: "not-a-url"
    }),
    /Format d'URL invalide/
  );
});

test("Roll-Up 20 - sponsor présent: pas de roll-up", async () => {
  const rollupService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/rollup.service.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({}),
        query: async () => ({ rows: [] })
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1"
        })
      },
      "../modules/users/users.repository": {
        findUserById: async () => ({
          id: "user-1",
          sponsor_id: "real-sponsor",
          is_root: false
        })
      },
      "../modules/followme/followme.repository": {
        findUserOpportunity: async (userId) =>
          userId === "real-sponsor"
            ? { status: "active" }
            : null,
        upsertUserOpportunity: async (payload) => payload,
        createRollupLog: async () => null
      },
      "../utils/logger": {
        logger: {
          error: () => {}
        }
      }
    }
  );

  const result = await rollupService.applyRollup(
    "user-1",
    "opp-1",
    { referralLink: "https://example.com" }
  );

  assert.equal(result.rollupApplied, false);
  assert.equal(result.sponsorId, "real-sponsor");
});

test("Roll-Up 21/23/24/25 - sponsor absent: roll-up root, log créé, sponsor réel inchangé, idempotent", async () => {
  const logs = [];

  const rollupService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/rollup.service.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({}),
        query: async () => ({ rows: [] })
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1"
        })
      },
      "../modules/users/users.repository": {
        findUserById: async (userId) => ({
          id: userId,
          sponsor_id: userId === "user-1" ? "real-sponsor" : null,
          email: `${userId}@example.com`,
          is_root: false
        })
      },
      "../modules/followme/followme.repository": {
        findUserOpportunity: async () => null,
        upsertUserOpportunity: async (payload) => ({
          sponsor_user_id: payload.sponsorUserId,
          referral_link: payload.referralLink
        }),
        createRollupLog: async (payload) => {
          const existing = logs.find((entry) =>
            entry.userId === payload.userId &&
            entry.opportunityId === payload.opportunityId
          );

          if (existing) {
            return existing;
          }

          logs.push(payload);
          return payload;
        }
      },
      "../utils/logger": {
        logger: {
          error: () => {}
        }
      }
    }
  );

  const first = await rollupService.applyRollup(
    "user-1",
    "opp-1",
    { referralLink: "https://example.com" }
  );
  const second = await rollupService.applyRollup(
    "user-1",
    "opp-1",
    { referralLink: "https://example.com" }
  );

  assert.equal(first.rollupApplied, true);
  assert.equal(first.sponsorId, "root-1");
  assert.equal(first.originalSponsorId, "real-sponsor");
  assert.equal(logs.length, 1);
  assert.equal(second.sponsorId, "root-1");
  assert.equal(logs.length, 1);
});

test("Roll-Up 22 - le Root ne se roll-up jamais lui-même", async () => {
  const rollupService = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/rollup.service.js",
    {
      "../config/db": {
        withTransaction: async (callback) =>
          callback({}),
        query: async () => ({ rows: [] })
      },
      "../db/v106-runtime": {
        resolveRootUser: async () => ({
          id: "root-1"
        })
      },
      "./opportunity.engine": {
        getOpportunityById: () => ({
          id: "opp-1"
        })
      },
      "../modules/users/users.repository": {
        findUserById: async () => ({
          id: "root-1",
          sponsor_id: null,
          is_root: true
        })
      },
      "../modules/followme/followme.repository": {
        findUserOpportunity: async () => null,
        upsertUserOpportunity: async (payload) => payload,
        createRollupLog: async () => null
      },
      "../utils/logger": {
        logger: {
          error: () => {}
        }
      }
    }
  );

  const result = await rollupService.applyRollup(
    "root-1",
    "opp-1",
    { referralLink: "https://example.com" }
  );

  assert.equal(result.rollupApplied, false);
  assert.equal(result.sponsorId, null);
});

test("Opportunity 26/27/28/29 - entry opportunity correcte, priorité respectée, inactive ignorée, absence gérée", async () => {
  const opportunityEngine = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/opportunity.engine.js",
    {
      "../modules/opportunities/opportunities.registry": {
        list: () => ([
          {
            id: "opp-3",
            status: "inactive",
            isAvailable: true,
            isEntry: true,
            priority: 1
          },
          {
            id: "opp-2",
            status: "active",
            isAvailable: true,
            isEntry: true,
            priority: 2
          },
          {
            id: "opp-1",
            status: "active",
            isAvailable: true,
            isEntry: true,
            priority: 1
          }
        ]),
        getById: () => null
      },
      "../modules/users/users.repository": {
        findUserById: async () => null
      }
    }
  );

  const entry = await opportunityEngine.getEntryOpportunity();
  assert.equal(entry.id, "opp-1");

  const emptyEngine = loadModule(
    "/home/runner/work/POINT_FOCAL/POINT_FOCAL/src/core/opportunity.engine.js",
    {
      "../modules/opportunities/opportunities.registry": {
        list: () => ([
          {
            id: "opp-x",
            status: "inactive",
            isAvailable: false,
            isEntry: true,
            priority: 1
          }
        ]),
        getById: () => null
      },
      "../modules/users/users.repository": {
        findUserById: async () => null
      }
    }
  );

  const none = await emptyEngine.getEntryOpportunity();
  assert.equal(none, null);
});
