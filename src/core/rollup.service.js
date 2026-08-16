/**
 * POINT FOCAL V10.4 - Service de Roll-up
 * 
 * Gère le mécanisme de roll-up pour la continuité généalogique.
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 12, 13, 14, 15, 34, 35
 * 
 * PRINCIPE :
 * Lorsqu'un filleul souhaite accéder à une opportunité pour laquelle
 * son parrain réel n'a pas encore rejoint, le système ne bloque pas.
 * Il applique le roll-up vers la racine pour cette opportunité.
 * 
 * Le sponsor réel est préservé dans le CORE.
 */

const { findUserById, getChildren, countChildren, findRoot } = require("../modules/users/users.repository");
const { getOpportunityById } = require("./opportunity.engine");
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

/**
 * Vérifie si un utilisateur a déjà rejoint une opportunité
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<boolean>} - True si l'utilisateur a rejoint l'opportunité
 */
async function hasUserJoinedOpportunity(userId, opportunityId) {
  const result = await query(
    `
    SELECT id FROM user_opportunities
    WHERE user_id = $1 AND opportunity_id = $2 AND status = 'active'
    `,
    [userId, opportunityId]
  );

  return result.rows.length > 0;
}

/**
 * Récupère la racine du système
 * 
 * @returns {Promise<Object|null>} - Utilisateur racine
 */
async function getRoot() {
  return await findRoot();
}

/**
 * Vérifie si un utilisateur est la racine
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - True si l'utilisateur est la racine
 */
async function isRoot(userId) {
  const user = await findUserById(userId);
  return user ? user.is_root === true : false;
}

/**
 * Applique le roll-up pour un utilisateur sur une opportunité
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @param {Object} options - Options
 * @param {string|number} options.fallbackUserId - Utilisateur de fallback (défaut: racine)
 * @returns {Promise<Object>} - Résultat du roll-up
 */
async function applyRollup(userId, opportunityId, options = {}) {
  try {
    // 1. Récupérer l'utilisateur
    const user = await findUserById(userId);

    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    // 2. Récupérer l'opportunité
    const opportunity = await getOpportunityById(opportunityId);

    if (!opportunity) {
      throw new Error('Opportunité introuvable');
    }

    // 3. Vérifier si l'utilisateur a déjà rejoint l'opportunité
    const alreadyJoined = await hasUserJoinedOpportunity(userId, opportunityId);

    if (alreadyJoined) {
      return {
        success: true,
        action: 'already_joined',
        message: 'L\'utilisateur a déjà rejoint cette opportunité',
        userId,
        opportunityId,
        sponsorId: user.sponsor_id
      };
    }

    // 4. Vérifier si l'utilisateur est la racine
    if (user.is_root === true) {
      return {
        success: true,
        action: 'root_user',
        message: 'L\'utilisateur est la racine, aucun roll-up nécessaire',
        userId,
        opportunityId
      };
    }

    // 5. Vérifier si le sponsor réel a rejoint l'opportunité
    const sponsorId = user.sponsor_id;
    let sponsorInOpportunity = false;

    if (sponsorId) {
      sponsorInOpportunity = await hasUserJoinedOpportunity(sponsorId, opportunityId);
    }

    // 6. Si le sponsor est présent dans l'opportunité → Follow Me normal
    if (sponsorInOpportunity) {
      return {
        success: true,
        action: 'follow_me',
        message: 'Le sponsor réel a rejoint l\'opportunité, Follow Me possible',
        userId,
        opportunityId,
        sponsorId,
        rollupApplied: false
      };
    }

    // 7. Si le sponsor n'est pas présent → ROLL-UP
    // Déterminer le parent de roll-up
    let rollupParentId = options.fallbackUserId || null;

    // Si pas de fallback, utiliser la racine
    if (!rollupParentId) {
      const root = await getRoot();

      if (!root) {
        throw new Error('Aucune racine trouvée dans le système');
      }

      rollupParentId = root.id;
    }

    // Vérifier que le parent de roll-up n'est pas l'utilisateur lui-même
    if (String(rollupParentId) === String(userId)) {
      throw new Error('Le parent de roll-up ne peut pas être l\'utilisateur lui-même');
    }

    // Vérifier si le parent de roll-up a rejoint l'opportunité
    const parentInOpportunity = await hasUserJoinedOpportunity(rollupParentId, opportunityId);

    if (!parentInOpportunity) {
      // Si le parent de roll-up n'a pas rejoint non plus, on remonte plus haut
      // Cas extrême : on utilise la racine
      const root = await getRoot();

      if (root && String(root.id) !== String(rollupParentId)) {
        rollupParentId = root.id;
      }

      // Vérifier si la racine a rejoint l'opportunité
      const rootInOpportunity = await hasUserJoinedOpportunity(rollupParentId, opportunityId);

      if (!rootInOpportunity) {
        // Si même la racine n'a pas rejoint, on crée une entrée pour la racine
        await addUserToOpportunity(rollupParentId, opportunityId, null);
      }
    }

    // 8. Enregistrer l'utilisateur dans l'opportunité avec le parent de roll-up
    const result = await addUserToOpportunity(userId, opportunityId, rollupParentId);

    // 9. Journaliser le roll-up
    await logRollupEvent({
      userId,
      opportunityId,
      originalSponsorId: sponsorId,
      rollupParentId,
      reason: 'sponsor_not_in_opportunity'
    });

    return {
      success: true,
      action: 'rollup',
      message: 'Roll-up appliqué avec succès',
      userId,
      opportunityId,
      originalSponsorId: sponsorId,
      rollupParentId,
      rollupApplied: true,
      data: result
    };

  } catch (error) {
    logger.error('[Rollup] Erreur:', error);
    throw error;
  }
}

/**
 * Ajoute un utilisateur à une opportunité
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @param {string|number|null} parentId - ID du parent (sponsor pour cette opportunité)
 * @returns {Promise<Object>} - Entrée créée
 */
async function addUserToOpportunity(userId, opportunityId, parentId = null) {
  const result = await query(
    `
    INSERT INTO user_opportunities (
      user_id,
      opportunity_id,
      sponsor_id_for_opportunity,
      status,
      joined_at,
      updated_at
    )
    VALUES ($1, $2, $3, 'active', NOW(), NOW())
    ON CONFLICT (user_id, opportunity_id)
    DO UPDATE SET
      sponsor_id_for_opportunity = COALESCE(EXCLUDED.sponsor_id_for_opportunity, user_opportunities.sponsor_id_for_opportunity),
      status = 'active',
      updated_at = NOW()
    RETURNING *
    `,
    [userId, opportunityId, parentId]
  );

  return result.rows[0] || null;
}

/**
 * Journalise un événement de roll-up
 * 
 * @param {Object} eventData - Données de l'événement
 * @returns {Promise<void>}
 */
async function logRollupEvent(eventData) {
  try {
    await query(
      `
      INSERT INTO rollup_logs (
        user_id,
        opportunity_id,
        original_sponsor_id,
        rollup_parent_id,
        reason,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        eventData.userId,
        eventData.opportunityId,
        eventData.originalSponsorId || null,
        eventData.rollupParentId || null,
        eventData.reason || 'sponsor_not_in_opportunity'
      ]
    );
  } catch (error) {
    logger.warn('[Rollup] Impossible de journaliser l\'événement:', error);
  }
}

/**
 * Récupère le parent d'un utilisateur dans une opportunité
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<Object|null>} - Parent trouvé ou null
 */
async function getOpportunityParent(userId, opportunityId) {
  const result = await query(
    `
    SELECT
      uo.sponsor_id_for_opportunity,
      u.id as parent_id,
      u.email as parent_email
    FROM user_opportunities uo
    LEFT JOIN users u ON u.id = uo.sponsor_id_for_opportunity
    WHERE uo.user_id = $1 AND uo.opportunity_id = $2 AND uo.status = 'active'
    `,
    [userId, opportunityId]
  );

  return result.rows[0] || null;
}

/**
 * Récupère l'historique des roll-up pour un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {number} limit - Nombre maximum de résultats
 * @returns {Promise<Array>} - Historique des roll-up
 */
async function getRollupHistory(userId, limit = 10) {
  const result = await query(
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
    [userId, limit]
  );

  return result.rows;
}

/**
 * Compte le nombre de roll-up pour un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @returns {Promise<number>} - Nombre de roll-up
 */
async function countRollups(userId) {
  const result = await query(
    `
    SELECT COUNT(*) as count
    FROM rollup_logs
    WHERE user_id = $1
    `,
    [userId]
  );

  return parseInt(result.rows[0]?.count || 0, 10);
}

/**
 * Vérifie si un roll-up est nécessaire pour un utilisateur sur une opportunité
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<boolean>} - True si un roll-up est nécessaire
 */
async function isRollupNeeded(userId, opportunityId) {
  try {
    // 1. Vérifier si l'utilisateur a déjà rejoint l'opportunité
    const hasJoined = await hasUserJoinedOpportunity(userId, opportunityId);

    if (hasJoined) {
      return false;
    }

    // 2. Récupérer l'utilisateur
    const user = await findUserById(userId);

    if (!user || user.is_root === true) {
      return false;
    }

    // 3. Vérifier si le sponsor a rejoint l'opportunité
    if (user.sponsor_id) {
      const sponsorJoined = await hasUserJoinedOpportunity(user.sponsor_id, opportunityId);

      if (sponsorJoined) {
        return false; // Follow Me possible
      }
    }

    // 4. Le sponsor n'est pas dans l'opportunité → roll-up nécessaire
    return true;

  } catch (error) {
    logger.error('[Rollup] Erreur isRollupNeeded:', error);
    return true; // En cas d'erreur, on préfère le roll-up
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