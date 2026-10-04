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
   * CAPACITE 2 JUMELEE = Roll-up + FIFO 2, ensemble, au maximum 2.
   *
   * IMPORTANT : on ne compte PAS tous les enfants de user_opportunities.
   * Un rattachement Follow Me/direct peut exister dans l'opportunite sans
   * avoir ete produit par le mecanisme Roll-up/FIFO 2 et ne doit donc pas
   * consommer cette capacite specifique.
   *
   * rollup_logs est le journal d'origine du placement :
   * - sponsor_not_in_opportunity       => Roll-up normal
   * - confirmed_root_inactivity_fifo2 => FIFO 2 jumelé au Roll-up
   *
   * Le DISTINCT protege le compteur contre un eventuel doublon historique
   * de journalisation pour un meme utilisateur dans la meme opportunite.
   */
  const result = await client.query(
    `
    SELECT COUNT(DISTINCT uo.user_id)::int AS count
    FROM user_opportunities uo
    WHERE uo.sponsor_user_id = $1
      AND uo.opportunity_id = $2
      AND uo.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM rollup_logs rl
        WHERE rl.user_id = uo.user_id
          AND rl.opportunity_id = uo.opportunity_id
          AND rl.rollup_parent_id = uo.sponsor_user_id
          AND rl.reason IN (
            'sponsor_not_in_opportunity',
            'confirmed_root_inactivity_fifo2'
          )
      )
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
     * INVARIANT S1 : FIFO 2 est propre a l'opportunite.
     * Il ne demarre que lorsque l'inactivite du Root DANS CETTE OPPORTUNITE
     * a ete confirmee. users.status n'est pas un signal suffisant.
     * La racine structurelle globale n'est jamais remplacee.
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
     * Un compte inactif/indisponible ne recoit aucun placement, MAIS sa
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
 * Compatibilite temporaire pour les appels historiques : aucune rotation
 * structurelle n'est desormais autorisee. Cette fonction ne modifie rien.
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
