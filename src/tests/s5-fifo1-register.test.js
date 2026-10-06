const test = require("node:test");
const assert = require("node:assert/strict");

const authRepository = require("../modules/auth/auth.repository");
const db = require("../config/db");
const runtime = require("../db/v106-runtime");
const email = require("../config/email");

const originalSendEmail = email.sendEmail;
email.sendEmail = async () => ({ accepted: true });

const authService = require("../modules/auth/auth.service");

async function withRegistrationStubs({ phase, root, fifoCandidate }, callback) {
  const client = { transactionClient: true };
  const runtimeState = {
    phase,
    root_user_id: root.id,
    leader_count: 0,
    leader_threshold: 50
  };
  const events = [];
  const createdUser = { id: "created-user", is_leader: false };
  const originals = [];

  function replace(target, key, value) {
    originals.push([target, key, target[key]]);
    target[key] = value;
  }

  replace(authRepository, "findUserByEmail", async () => null);
  replace(authRepository, "getActiveCampaign", async () => ({ id: "campaign-1" }));
  replace(authRepository, "findUserByInvitationCode", async () => null);
  replace(authRepository, "findOldestAvailableSponsorForFifo", async (options) => {
    assert.equal(options.client, client);
    events.push("fifo");
    return fifoCandidate;
  });
  replace(authRepository, "createUser", async (payload, options) => {
    assert.equal(options.client, client);
    createdUser.sponsor_id = payload.sponsorId;
    events.push("createUser");
    return createdUser;
  });
  replace(authRepository, "saveEmailOtp", async () => {
    events.push("saveOtp");
  });
  replace(db, "withTransaction", async (callback) => {
    events.push("begin");
    try {
      const result = await callback(client);
      events.push("commit");
      return result;
    } catch (error) {
      events.push("rollback");
      throw error;
    }
  });
  replace(runtime, "getRuntimeState", async (options) => {
    assert.equal(options.client, client);
    return runtimeState;
  });
  replace(runtime, "resolveRootUser", async (options) => {
    assert.equal(options.client, client);
    events.push("root");
    return root;
  });
  replace(runtime, "assignGlobalSponsor", async (sponsorId, childId, options) => {
    assert.equal(options.client, client);
    events.push(["placement", sponsorId, childId]);
    return { sponsor_user_id: sponsorId, child_user_id: childId };
  });

  try {
    const result = await authService.register({
      email: "new-user@example.com",
      whatsapp: "+243000000000",
      password: "test-password",
      confirmPassword: "test-password"
    });
    return { result, events, createdUser };
  } finally {
    for (const [target, key, original] of originals.reverse()) {
      target[key] = original;
    }
  }
}

test("S5 FIFO 1 - en LEADER_LAUNCH une inscription sans code va à root, sans FIFO", async () => {
  const root = { id: "root-user" };
  const candidate = { id: "fifo-candidate" };
  const { result, events, createdUser } = await withRegistrationStubs({
    phase: "LEADER_LAUNCH",
    root,
    fifoCandidate: candidate
  }, (value) => value);

  assert.equal(createdUser.sponsor_id, root.id);
  assert.equal(result.sponsorAssignment, "root");
  assert.equal(events.includes("fifo"), false);
  assert.equal(
    events.some((event) => Array.isArray(event) && event[0] === "placement"),
    false
  );
});

test("S5 FIFO 1 - en NORMAL_OPERATION le parrain FIFO devient sponsor personnel et structurel", async () => {
  const root = { id: "root-user" };
  const candidate = { id: "fifo-candidate" };
  const { result, events, createdUser } = await withRegistrationStubs({
    phase: "NORMAL_OPERATION",
    root,
    fifoCandidate: candidate
  });

  assert.equal(createdUser.sponsor_id, candidate.id);
  assert.equal(result.sponsorAssignment, "fifo");
  assert.equal(
    events.some((event) =>
      Array.isArray(event) &&
      event[0] === "placement" &&
      event[1] === candidate.id &&
      event[2] === createdUser.id
    ),
    true
  );
});

test("S5 FIFO 1 - sans candidat disponible, NORMAL_OPERATION retombe sur root", async () => {
  const root = { id: "root-user" };
  const { result, events, createdUser } = await withRegistrationStubs({
    phase: "NORMAL_OPERATION",
    root,
    fifoCandidate: null
  });

  assert.equal(createdUser.sponsor_id, root.id);
  assert.equal(result.sponsorAssignment, "root");
  assert.equal(events.includes("fifo"), true);
  assert.equal(events.includes("root"), true);
  assert.equal(
    events.some((event) =>
      Array.isArray(event) &&
      event[0] === "placement" &&
      event[1] === root.id &&
      event[2] === createdUser.id
    ),
    true
  );
});

test.after(() => {
  email.sendEmail = originalSendEmail;
});
