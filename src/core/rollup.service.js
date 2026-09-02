const db = require("../config/db");
const v106Runtime = require("../db/v106-runtime");
const { getOpportunityById } = require("./opportunity.engine");
const usersRepository = require("../modules/users/users.repository");
const followmeRepository = require("../modules/followme/followme.repository");
const { logger } = require("../utils/logger");

async function hasUserJoinedOpportunity(
  userId,
  opportunityId,
  options = {}
) {
  const entry =
    await followmeRepository.findUserOpportunity(
      userId,
      opportunityId,
      options
    );

  return entry?.status === "active";
}

async function getRoot(options = {}) {
  const rootUser =
    await v106Runtime.resolveRootUser(options);

  return rootUser?.id ? rootUser : null;
}

async function isRoot(userId, options = {}) {
  const rootUser = await getRoot(options);
  return !!rootUser && String(rootUser.id) === String(userId);
}

async function resolvePlacement(
  userId,
  opportunityId,
  options = {}
) {
  const user = await usersRepository.findUserById(
    userId,
    options
  );

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const opportunity = await getOpportunityById(opportunityId);

  if (!opportunity) {
    throw new Error("Opportunité introuvable");
  }

  if (user.is_root === true) {
    return {
      action: "root_user",
      rollupApplied: false,
      sponsorId: null,
      originalSponsorId: user.sponsor_id || null
    };
  }

  const requestedSponsorId =
    options.requestedSponsorId ??
    user.sponsor_id ??
    null;

  if (
    requestedSponsorId &&
    String(requestedSponsorId) === String(userId)
  ) {
    throw new Error(
      "Le parent d'opportunité ne peut pas être l'utilisateur lui-même"
    );
  }

  if (
    requestedSponsorId &&
    await hasUserJoinedOpportunity(
      requestedSponsorId,
      opportunityId,
      options
    )
  ) {
    return {
      action: "follow_me",
      rollupApplied: false,
      sponsorId: requestedSponsorId,
      originalSponsorId: user.sponsor_id || null
    };
  }

  const rootUser = await getRoot(options);

  if (!rootUser?.id) {
    throw new Error("Compte Root V10.6 introuvable");
  }

  if (String(rootUser.id) === String(userId)) {
    return {
      action: "root_user",
      rollupApplied: false,
      sponsorId: null,
      originalSponsorId: user.sponsor_id || null
    };
  }

  return {
    action: "rollup",
    rollupApplied: true,
    sponsorId: rootUser.id,
    originalSponsorId: user.sponsor_id || null
  };
}

async function applyRollup(
  userId,
  opportunityId,
  options = {}
) {
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  try {
    return await execute(async (client) => {
      const repositoryOptions = { client };
      const existing =
        await followmeRepository.findUserOpportunity(
          userId,
          opportunityId,
          repositoryOptions
        );

      const resolution = await resolvePlacement(
        userId,
        opportunityId,
        {
          ...options,
          client
        }
      );

      const referralLink =
        options.referralLink ??
        existing?.referral_link ??
        null;

      let data = existing || null;

      if (referralLink) {
        data = await followmeRepository.upsertUserOpportunity(
          {
            userId,
            opportunityId,
            referralLink,
            targetAddress:
              options.targetAddress ??
              existing?.target_address ??
              null,
            paymentHash:
              options.paymentHash ??
              existing?.payment_hash ??
              null,
            sponsorUserId: resolution.sponsorId,
            status: "active"
          },
          repositoryOptions
        );
      }

      let rollupLog = null;

      if (resolution.rollupApplied) {
        rollupLog =
          await followmeRepository.createRollupLog(
            {
              userId,
              opportunityId,
              originalSponsorId:
                resolution.originalSponsorId,
              rollupParentId:
                resolution.sponsorId,
              reason: "sponsor_not_in_opportunity"
            },
            repositoryOptions
          );
      }

      return {
        success: true,
        action: resolution.action,
        userId,
        opportunityId,
        sponsorId: resolution.sponsorId,
        originalSponsorId:
          resolution.originalSponsorId,
        rollupApplied:
          resolution.rollupApplied,
        data,
        rollupLog
      };
    });
  } catch (error) {
    logger.error("[Rollup] Erreur:", error);
    throw error;
  }
}

async function getOpportunityParent(
  userId,
  opportunityId,
  options = {}
) {
  const entry =
    await followmeRepository.findUserOpportunity(
      userId,
      opportunityId,
      options
    );

  if (!entry?.sponsor_user_id) {
    return null;
  }

  const parent =
    await usersRepository.findUserById(
      entry.sponsor_user_id,
      options
    );

  return {
    sponsor_user_id: entry.sponsor_user_id,
    parent_id: parent?.id || null,
    parent_email: parent?.email || null
  };
}

async function getRollupHistory(
  userId,
  limit = 10,
  options = {}
) {
  const result = await db.query(
    `
    SELECT
      rl.*,
      o.name as opportunity_name
    FROM rollup_logs rl
    LEFT JOIN opportunities o ON o.id = rl.opportunity_id
    WHERE rl.user_id = $1
    ORDER BY rl.created_at DESC
    LIMIT $2
    `,
    [userId, limit],
    options.client || null
  );

  return result.rows;
}

async function countRollups(
  userId,
  options = {}
) {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS count
    FROM rollup_logs
    WHERE user_id = $1
    `,
    [userId],
    options.client || null
  );

  return result.rows[0]?.count || 0;
}

async function isRollupNeeded(
  userId,
  opportunityId,
  options = {}
) {
  const resolution = await resolvePlacement(
    userId,
    opportunityId,
    options
  );

  return resolution.rollupApplied;
}

module.exports = {
  applyRollup,
  countRollups,
  getOpportunityParent,
  getRollupHistory,
  getRoot,
  hasUserJoinedOpportunity,
  isRoot,
  isRollupNeeded,
  resolvePlacement
};
