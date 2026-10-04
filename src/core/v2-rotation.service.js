const db = require("../config/db");
const v106Runtime = require("../db/v106-runtime");

async function getDirectChildren(client, parentId) {
  const result = await client.query(
    `
    SELECT gs.child_user_id, gs.slot_no, gs.created_at,
           u.status, u.email_confirmed, u.link_active
    FROM v106_global_sponsorships gs
    JOIN users u ON u.id = gs.child_user_id
    WHERE gs.sponsor_user_id = $1
    ORDER BY gs.slot_no ASC, gs.created_at ASC, gs.child_user_id ASC
    `,
    [parentId]
  );
  return result.rows;
}

async function isConfirmedInactive(client, userId, opportunityId) {
  const result = await client.query(
    `
    SELECT 1
    FROM opportunity_inactivity_confirmations
    WHERE user_id = $1
      AND opportunity_id = $2
      AND state = 'confirmed'
    LIMIT 1
    `,
    [userId, opportunityId]
  );
  return result.rows.length > 0;
}

async function countOpportunityChildren(client, parentId, opportunityId) {
  /*
   * CAPACITE 2 JUMELEE : user_opportunities.sponsor_user_id est le parent
   * effectif de l'opportunité, qu'il provienne du Roll-up ou de FIFO 2.
   * Les deux mécanismes consomment donc le MEME compteur, jamais 2 + 2.
   */
  const result = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM user_opportunities
    WHERE sponsor_user_id = $1
      AND opportunity_id = $2
      AND status = 'active'
    `,
    [parentId, opportunityId]
  );
  return result.rows[0]?.count || 0;
}

async function getV2Parent(userId, opportunityId, options = {}) {
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    const root = await v106Runtime.resolveRootUser({ client });
    if (!root) {
      throw new Error("Aucun Root Point Focal disponible.");
    }

    /*
     * INVARIANT S1 : FIFO 2 est propre à l'opportunité.
     * Il ne démarre que lorsque l'inactivité du Root DANS CETTE OPPORTUNITE
     * a été confirmée. users.status n'est pas un signal suffisant.
     * La racine structurelle globale n'est jamais remplacée.
     */
    const rootInactive = await isConfirmedInactive(
      client,
      root.id,
      opportunityId
    );

    if (!rootInactive) {
      throw new Error("FIFO2_ROOT_INACTIVITY_NOT_CONFIRMED");
    }

    /*
     * Parcours FIFO en largeur puis en profondeur : niveau par niveau.
     * Un compte inactif/indisponible ne reçoit aucun placement, MAIS sa
     * descendance reste dans la file afin que la recherche continue en
     * profondeur au lieu de couper toute sa branche.
     */
    let currentLevel = [root.id];
    const visited = new Set([String(root.id)]);

    while (currentLevel.length > 0) {
      const nextLevel = [];

      for (const parentId of currentLevel) {
        const children = await getDirectChildren(client, parentId);

        for (const child of children) {
          const childId = String(child.child_user_id);
          if (visited.has(childId)) continue;
          visited.add(childId);

          // Toujours conserver la branche pour le prochain niveau.
          nextLevel.push(child.child_user_id);

          if (childId === String(userId)) continue;

          const childInactive = await isConfirmedInactive(
            client,
            child.child_user_id,
            opportunityId
          );

          if (
            child.status !== "active" ||
            child.email_confirmed !== true ||
            childInactive
          ) {
            continue;
          }

          const count = await countOpportunityChildren(
            client,
            child.child_user_id,
            opportunityId
          );

          if (count < 2) {
            return {
              parentId: child.child_user_id,
              rootId: root.id,
              structuralRootUnchanged: true,
              capacityUsed: count,
              capacityRemaining: 2 - count
            };
          }
        }
      }

      currentLevel = nextLevel;
    }

    throw new Error("FIFO2_NO_SHARED_CAPACITY_AVAILABLE");
  });
}

/*
 * Compatibilité temporaire pour les appels historiques : aucune rotation
 * structurelle n'est désormais autorisée. Cette fonction ne modifie rien.
 */
async function rotateIfRootInactive(options = {}) {
  const root = await v106Runtime.resolveRootUser(options);
  return {
    rotated: false,
    reason: "structural_root_is_immutable",
    rootUserId: root?.id || null
  };
}

module.exports = {
  rotateIfRootInactive,
  getV2Parent,
  isConfirmedInactive,
  countOpportunityChildren
};
