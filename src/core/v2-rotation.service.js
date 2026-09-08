const db = require("../config/db");
const v106Runtime = require("../db/v106-runtime");

async function getDirectChildren(client, rootId) {
  const result = await client.query(
    `
    SELECT
      gs.child_user_id,
      gs.slot_no,
      gs.created_at,
      u.status,
      u.email_confirmed,
      u.link_active
    FROM v106_global_sponsorships gs
    JOIN users u ON u.id = gs.child_user_id
    WHERE gs.sponsor_user_id = $1
    ORDER BY
      gs.slot_no ASC,
      gs.created_at ASC,
      gs.child_user_id ASC
    `,
    [rootId]
  );

  return result.rows;
}

async function countOpportunityChildren(client, parentId, opportunityId) {
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

async function rotateIfRootInactive(options = {}) {
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    /*
     * Le verrou sur le singleton garantit qu'une seule requête
     * peut effectuer une rotation à la fois.
     */
    const stateResult = await client.query(
      `
      SELECT
        root_user_id,
        phase
      FROM v106_runtime_state
      WHERE singleton_id = true
      FOR UPDATE
      `
    );

    const state = stateResult.rows[0];

    if (!state?.root_user_id) {
      return {
        rotated: false,
        reason: "no_root"
      };
    }

    const currentRootResult = await client.query(
      `
      SELECT
        id,
        status,
        email_confirmed,
        link_active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [state.root_user_id]
    );

    const currentRoot = currentRootResult.rows[0];

    /*
     * Le Root existe encore et reste actif :
     * aucune rotation.
     */
    if (
      currentRoot &&
      currentRoot.status === "active"
    ) {
      return {
        rotated: false,
        reason: "root_active",
        rootUserId: currentRoot.id
      };
    }

    /*
     * Root supprimé ou devenu inaccessible :
     * récupérer ses anciens filleuls directs.
     */
    const children = await getDirectChildren(
      client,
      state.root_user_id
    );

    if (!children.length) {
      return {
        rotated: false,
        reason: "no_successor",
        oldRootUserId: state.root_user_id
      };
    }

    /*
     * Le premier filleul FIFO actif devient le nouveau Root.
     */
      const successor =
        children.find(
          (child) =>
            child.status === "active" &&
            child.email_confirmed === true
        );

    if (!successor) {
      return {
        rotated: false,
        reason: "no_active_successor",
        oldRootUserId: state.root_user_id
      };
    }

    await v106Runtime.setRootUser(
      successor.child_user_id,
      { client }
    );

    return {
      rotated: true,
      oldRootUserId: state.root_user_id,
      newRootUserId: successor.child_user_id,
      fifoChildren: children.map((child) => ({
        userId: child.child_user_id,
        slotNo: child.slot_no,
        createdAt: child.created_at,
        status: child.status
      }))
    };
  });
}

async function getV2Parent(
  userId,
  opportunityId,
  options = {}
) {
  const execute = options.client
    ? async (callback) => callback(options.client)
    : db.withTransaction;

  return execute(async (client) => {
    const rotation = await rotateIfRootInactive({
      client
    });

    if (
      rotation.reason === "no_successor" ||
      rotation.reason === "no_active_successor"
    ) {
      throw new Error(
        "Le Root Point Focal est inactif et aucune rotation V2 n'est disponible."
      );
    }

    const rootId =
      rotation.newRootUserId ||
      (
        await v106Runtime.resolveRootUser({
          client
        })
      )?.id;

    if (!rootId) {
      throw new Error(
        "Aucun Root Point Focal disponible."
      );
    }

    /*
     * Le nouveau Root est le point d'ancrage
     * ultime. Les anciens filleuls du Root sont
     * parcourus en FIFO.
     */
      let oldRootId = rotation.oldRootUserId || null;

      if (!oldRootId) {
        const previousRootResult = await client.query(
          `
          SELECT sponsor_user_id
          FROM v106_global_sponsorships
          WHERE child_user_id = $1
          ORDER BY created_at ASC
          LIMIT 1
          `,
          [rootId]
        );

        oldRootId =
          previousRootResult.rows[0]?.sponsor_user_id || rootId;
      }

      const children = await getDirectChildren(
        client,
        oldRootId
      );

      const fifoParents = children.filter(
        (child) =>
          child.status === "active" &&
          child.email_confirmed === true
      );

      for (const parent of fifoParents) {
        if (
          String(parent.child_user_id) === String(userId)
        ) {
          continue;
        }

        const count = await countOpportunityChildren(
          client,
          parent.child_user_id,
          opportunityId
        );

        if (count < 2) {
          return {
            parentId: parent.child_user_id,
            rootId,
            rotation,
            capacityUsed: count,
            capacityRemaining: 2 - count
          };
        }
      }

    throw new Error(
      "Aucune capacité V2 disponible dans la rotation FIFO."
    );
  });
}

module.exports = {
  rotateIfRootInactive,
  getV2Parent
};
