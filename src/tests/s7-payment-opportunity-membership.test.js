const test = require("node:test");
const assert = require("node:assert/strict");

const modulePaths = {
  db: require.resolve("../config/db"),
  paymentRepository: require.resolve("../modules/payments/payments.repository"),
  opportunityService: require.resolve("../modules/opportunities/opportunities.service"),
  opportunityEngine: require.resolve("../core/opportunity.engine"),
  opportunityRegistry: require.resolve("../modules/opportunities/opportunities.registry"),
  opportunityRepository: require.resolve("../modules/opportunities/opportunities.repository"),
  followmeEngine: require.resolve("../core/followme.engine"),
  logger: require.resolve("../utils/logger"),
  codeGenerator: require.resolve("../utils/codeGenerator"),
  blockchain: require.resolve("../config/blockchain"),
  authRepository: require.resolve("../modules/auth/auth.repository"),
  paymentService: require.resolve("../modules/payments/payments.service")
};
const originalModules = Object.fromEntries(
  Object.entries(modulePaths).map(([key, path]) => [key, require.cache[path]])
);

function cacheModule(path, exports) {
  require.cache[path] = {
    id: path,
    filename: path,
    loaded: true,
    exports
  };
}

const usdtContract = "0x" + "1".repeat(40);
const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const targetAddress = "0x" + "a".repeat(40);
const txHash = "0x" + "f".repeat(64);
const transactionClient = { transaction: "payment-validation" };
let transactionOpen = false;
let registeredMembership = null;

const nowSeconds = Math.floor(Date.now() / 1000);
const amountRaw = (203n * 10n ** 16n).toString(16);

cacheModule(modulePaths.db, {
  withTransaction: async (callback) => {
    transactionOpen = true;
    try {
      return await callback(transactionClient);
    } finally {
      transactionOpen = false;
    }
  }
});
cacheModule(modulePaths.paymentRepository, {
  async findUserPaymentStart() {
    return {
      id: "user-42",
      campaign_id: "campaign-1",
      victory_assigned_at: new Date((nowSeconds - 120) * 1000).toISOString(),
      victory_expires_at: new Date((nowSeconds + 3600) * 1000).toISOString(),
      victory_expired: false,
      status: "active",
      link_active: false,
      invitation_code: null,
      victory_personal_link: null
    };
  },
  async findUserByVictoryIdentifier() { return null; },
  async findPaymentByHash() { return null; },
  async savePayment() { return { id: "payment-1" }; },
  async saveVictoryPersonalLink(_userId, victoryLink) {
    return { victory_personal_link: victoryLink };
  },
  async activatePointFocalLink(_userId, invitationCode) {
    return { invitation_code: invitationCode };
  }
});
cacheModule(modulePaths.opportunityEngine, {
  getEntryOpportunity: async () => null,
  getGeneratorOpportunity: async () => null,
  getNextOpportunity: async () => null,
  getOpportunityBySlug: async (slug) => ({
    id: "va-opportunity",
    slug,
    status: "active",
    isAvailable: true
  }),
  getOpportunityById: async (id) => ({
    id,
    slug: "victory-automatic",
    status: "active",
    isAvailable: true
  }),
  getAvailableOpportunities: () => []
});
cacheModule(modulePaths.opportunityRegistry, { list: () => [] });
cacheModule(modulePaths.opportunityRepository, {});
cacheModule(modulePaths.logger, { logger: { error() {}, warn() {} } });
cacheModule(modulePaths.followmeEngine, {
  async registerUserLink(data, options) {
    registeredMembership = { data, options, transactionOpen };
    return { success: true, data: { id: "membership-1" } };
  }
});
cacheModule(modulePaths.codeGenerator, {
  async generateUniqueInvitationCodes() { return ["ABCD1000"]; }
});
cacheModule(modulePaths.authRepository, {
  async findUserByInvitationCode() { return null; }
});
cacheModule(modulePaths.blockchain, {
  USDT_CONTRACT: usdtContract,
  ERC20_TRANSFER_TOPIC: transferTopic,
  web3: {
    eth: {
      async getTransactionReceipt() {
        return {
          status: true,
          blockNumber: 10,
          logs: [{
            address: usdtContract,
            topics: [
              transferTopic,
              "0x" + "0".repeat(64),
              "0x" + "0".repeat(24) + targetAddress.slice(2)
            ],
            data: "0x" + amountRaw
          }]
        };
      },
      async getBlockNumber() { return 30; },
      async getBlock() { return { timestamp: nowSeconds }; }
    },
    utils: {
      isAddress() { return true; },
      isHexStrict() { return true; }
    }
  }
});

const paymentService = require("../modules/payments/payments.service");

test("validated Victory Automatic payment records opportunity membership in the same transaction", async () => {
  const victoryLink = "https://victoryautomatic.com/user/register/member-42";
  const result = await paymentService.autoTrigger("user-42", {
    victoryLink,
    adresseCible: targetAddress,
    txHash
  });

  assert.equal(result.success, true);
  assert.ok(registeredMembership);
  assert.equal(registeredMembership.transactionOpen, true);
  assert.equal(registeredMembership.options.client, transactionClient);
  assert.equal(registeredMembership.data.userId, "user-42");
  assert.equal(registeredMembership.data.opportunityId, "va-opportunity");
  assert.equal(registeredMembership.data.referralLink, victoryLink);
  assert.equal(registeredMembership.data.targetAddress, targetAddress);
  assert.equal(registeredMembership.data.paymentHash, txHash);
  assert.equal(transactionOpen, false);
});

test.after(() => {
  delete require.cache[modulePaths.paymentService];
  delete require.cache[modulePaths.opportunityService];
  for (const [key, path] of Object.entries(modulePaths)) {
    if (originalModules[key]) require.cache[path] = originalModules[key];
    else delete require.cache[path];
  }
});
