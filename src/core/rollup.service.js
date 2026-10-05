/**
 * POINT FOCAL — Roll-up / Follow Me / FIFO 2
 * Le sponsor structurel users.sponsor_id et la racine globale sont immuables.
 */
const { findUserById } = require("../modules/users/users.repository");
const { getOpportunityById } = require("./opportunity.engine");
const { query } = require("../config/db");
const { logger } = require("../utils/logger");
const v106Runtime = require("../db/v106-runtime");
const fifo2 = require("./v2-rotation.service");

async function hasUserJoinedOpportunity(userId, opportunityId, options = {}) {
  const executeQuery = options.client ? options.client.query.bind(options.client) : query;
  const result = await executeQuery(
    `SELECT id FROM user_opportunities
     WHERE user_id = $1 AND opportunity_id = $2 AND status = 'active'`,
    [userId, opportunityId]
  );
  return result.rows.length > 0;
}

async function getRoot(options = {}) {
  return v106Runtime.resolveRootUser(options);
}

async function isRoot(userId) {
  const root = await v106Runtime.resolveRootUser();
  return Boolean(root && String(root.id) === String(userId));
}

async function addUserToOpportunity(userId, opportunityId, parentId = null, options = {}) {
  const executeQuery = options.client ? options.client.query.bind(options.client) : query;
  const result = await executeQuery(
    `INSERT INTO user_opportunities
       (user_id, opportunity_id, sponsor_user_id, status, joined_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())
     ON CONFLICT (user_id, opportunity_id)
     DO UPDATE SET
       sponsor_user_id = COALESCE(EXCLUDED.sponsor_user_id, user_opportunities.sponsor_user_id),
       status = 'active', updated_at = NOW()
     RETURNING *`,
    [userId, opportunityId, parentId]
  );
  return result.rows[0] || null;
}

async function logRollupEvent(eventData, options = {}) {
  const executeQuery = options.client ? options.client.query.bind(options.client) : query;
  try {
    await executeQuery(
      `INSERT INTO rollup_logs
       (user_id, opportunity_id, original_sponsor_id, rollup_parent_id, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [eventData.userId, eventData.opportunityId,
       eventData.originalSponsorId || null, eventData.rollupParentId || null,
       eventData.reason || "sponsor_not_in_opportunity"]
    );
  } catch (error) {
    logger.warn("[Rollup] Impossible de journaliser l'événement:", error);
    if (options.client) throw error;
  }
}

async function applyRollup(userId, opportunityId, options = {}) {
  const dbClient = options.client;
  try {
    const user = await findUserById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    const opportunity = await getOpportunityById(opportunityId);
    if (!opportunity) throw new Error("Opportunité introuvable");

    if (await hasUserJoinedOpportunity(userId, opportunityId, { client: dbClient })) {
      return { success: true, action: "already_joined", userId, opportunityId, sponsorId: user.sponsor_id };
    }

    const root = await getRoot({ client: dbClient });
    if (!root) throw new Error("Aucune racine trouvée dans le système");

    if (String(root.id) === String(userId)) {
      return { success: true, action: "root_user", userId, opportunityId };
    }

    const sponsorId = user.sponsor_id;
    const sponsorInOpportunity = sponsorId
      ? await hasUserJoinedOpportunity(sponsorId, opportunityId, { client: dbClient })
      : false;

    /*
     * Invariant S1 : un sponsor présent dans l'opportunité peut devenir
     * indisponible dans CE business. Seule une confirmation automatique
     * préalable autorise FIFO 2. reported/indeterminate/rejected ne suffisent pas.
     */
    const sponsorConfirmedInactive = sponsorId && sponsorInOpportunity
      ? await fifo2.isConfirmedInactive(dbClient, sponsorId, opportunityId)
      : false;

    if (sponsorInOpportunity && !sponsorConfirmedInactive) {
      return {
        success: true, action: "follow_me", userId, opportunityId,
        sponsorId, rollupApplied: false
      };
    }

    let rollupParentId = root.id;
    let reason = "sponsor_not_in_opportunity";
    let fifo2Applied = false;

    if (sponsorConfirmedInactive) {
      const fifo2Result = await fifo2.getV2Parent(userId, opportunityId, {
        client: dbClient,
        unavailableUserId: sponsorId
      });
      rollupParentId = fifo2Result.parentId;
      reason = "confirmed_account_inactivity_fifo2";
      fifo2Applied = true;
    } else {
      /*
       * Roll-Up normal : le sponsor structurel n'est pas dans l'opportunité.
       * Si la racine elle-même a été confirmée indisponible dans ce business,
       * le même mécanisme FIFO 2 s'applique à partir de cette racine.
       */
      const rootConfirmedInactive = await fifo2.isConfirmedInactive(
        dbClient,
        root.id,
        opportunityId
      );

      if (rootConfirmedInactive) {
        const fifo2Result = await fifo2.getV2Parent(userId, opportunityId, {
          client: dbClient,
          unavailableUserId: root.id
        });
        rollupParentId = fifo2Result.parentId;
        reason = "confirmed_account_inactivity_fifo2";
        fifo2Applied = true;
      }
    }

    if (String(rollupParentId) === String(userId)) {
      throw new Error("Le parent de roll-up ne peut pas être l'utilisateur lui-même");
    }

    if (!(await hasUserJoinedOpportunity(rollupParentId, opportunityId, { client: dbClient }))) {
      await addUserToOpportunity(rollupParentId, opportunityId, null, { client: dbClient });
    }

    const result = await addUserToOpportunity(
      userId, opportunityId, rollupParentId, { client: dbClient }
    );

    await logRollupEvent({
      userId, opportunityId, originalSponsorId: sponsorId,
      rollupParentId, reason
    }, { client: dbClient });

    return {
      success: true,
      action: fifo2Applied ? "fifo2_rollup" : "rollup",
      userId,
      opportunityId,
      originalSponsorId: sponsorId,
      rollupParentId,
      rollupApplied: true,
      fifo2Applied,
      structuralRootId: root.id,
      structuralRootUnchanged: true,
      data: result
    };
  } catch (error) {
    logger.error("[Rollup] Erreur:", error);
    throw error;
  }
}

async function getOpportunityParent(userId, opportunityId) {
  const result = await query(
    `SELECT uo.sponsor_user_id, u.id AS parent_id, u.email AS parent_email
     FROM user_opportunities uo
     LEFT JOIN users u ON u.id = uo.sponsor_user_id
     WHERE uo.user_id = $1 AND uo.opportunity_id = $2 AND uo.status = 'active'`,
    [userId, opportunityId]
  );
  return result.rows[0] || null;
}

async function getRollupHistory(userId, limit = 10) {
  const result = await query(
    `SELECT rl.*, o.name AS opportunity_name
     FROM rollup_logs rl LEFT JOIN opportunities o ON o.id = rl.opportunity_id
     WHERE rl.user_id = $1 ORDER BY rl.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function countRollups(userId) {
  const result = await query(`SELECT COUNT(*) AS count FROM rollup_logs WHERE user_id = $1`, [userId]);
  return parseInt(result.rows[0]?.count || 0, 10);
}

async function isRollupNeeded(userId, opportunityId) {
  try {
    if (await hasUserJoinedOpportunity(userId, opportunityId)) return false;
    const user = await findUserById(userId);
    if (!user) return false;
    if (await isRoot(userId)) return false;
    if (user.sponsor_id && await hasUserJoinedOpportunity(user.sponsor_id, opportunityId)) {
      return await fifo2.isConfirmedInactive(null, user.sponsor_id, opportunityId);
    }
    return true;
  } catch (error) {
    logger.error("[Rollup] Erreur isRollupNeeded:", error);
    return true;
  }
}

module.exports = {
  applyRollup,
  hasUserJoinedOpportunity,
  getRoot,
  isRoot,
  addUserToOpportunity,
  getOpportunityParent,
  getRollupHistory,
  countRollups,
  isRollupNeeded,
  logRollupEvent
};
