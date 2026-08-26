/**
 * POINT FOCAL V10.4 - Moteur Follow Me
 * 
 * Cœur du système Follow Me.
 * Gère l'enregistrement, la validation et la recherche des liens d'opportunités.
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 6, 7, 8, 9, 10, 11, 31
 * 
 * PRINCIPE :
 * Toutes les opportunités sont compatibles avec Follow Me.
 * Le moteur collecte les liens personnels des utilisateurs pour chaque opportunité.
 * Ces liens alimentent la base et permettent le suivi généalogique.
 */

const { query } = require("../config/db");
const { findUserById, findUserByInvitationCode } = require("../modules/users/users.repository");
const { getOpportunityById, getOpportunityBySlug } = require("./opportunity.engine");
const { applyRollup, hasUserJoinedOpportunity, isRollupNeeded } = require("./rollup.service");
const { logger } = require("../utils/logger");
const { isValidUrl } = require("../utils/validators");

/**
 * Enregistre le lien personnel d'un utilisateur pour une opportunité
 * 
 * @param {Object} data - Données d'enregistrement
 * @param {string|number} data.userId - ID de l'utilisateur
 * @param {string|number} data.opportunityId - ID de l'opportunité
 * @param {string} data.referralLink - Lien personnel de l'utilisateur
 * @param {string} data.targetAddress - Adresse cible (optionnel)
 * @param {string} data.paymentHash - Hash de paiement (optionnel)
 * @param {string} data.sponsorId - ID du sponsor pour cette opportunité (optionnel)
 * @returns {Promise<Object>} - Résultat de l'enregistrement
 */
async function registerUserLink({
  userId,
  opportunityId,
  referralLink,
  targetAddress = null,
  paymentHash = null,
  sponsorId = null
}) {
  try {
    // 1. Valider les paramètres
    if (!userId) {
      throw new Error('Utilisateur non authentifié');
    }

    if (!opportunityId) {
      throw new Error('Opportunité non spécifiée');
    }

    if (!referralLink) {
      throw new Error('Lien de parrainage obligatoire');
    }

    // 2. Vérifier l'utilisateur
    const user = await findUserById(userId);

    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    // 3. Vérifier l'opportunité
    const opportunity = await getOpportunityById(opportunityId);

    if (!opportunity) {
      throw new Error('Opportunité introuvable');
    }

    // 4. Vérifier que l'opportunité est active et disponible
    const isActive = opportunity.status === 'active' || opportunity.isActive === true;
    const isAvailable = opportunity.isAvailable !== false;

    if (!isActive || !isAvailable) {
      throw new Error('Opportunité non disponible');
    }

    // 5. Valider le format du lien (si validateur spécifique)
    if (opportunity.validationRules) {
      const isValid = await validateLink(referralLink, opportunity.validationRules);

      if (!isValid) {
        throw new Error('Format de lien invalide pour cette opportunité');
      }
    }

    // 6. Vérifier que le sponsor associé au lien existe (si nécessaire)
    let extractedSponsorId = sponsorId;

    if (opportunity.requiresSponsorValidation !== false) {
      const extracted = await extractSponsorFromLink(referralLink, opportunity);

      if (extracted) {
        extractedSponsorId = extracted;
      }
    }

    // 7. Vérifier que le sponsor est présent dans la base (si requis)
    if (opportunity.requiresSponsorInDb === true && extractedSponsorId) {
      const sponsor = await findUserById(extractedSponsorId);

      if (!sponsor) {
        throw new Error('Le sponsor associé à ce lien n\'est pas enregistré dans Point Focal');
      }
    }

    // 8. Vérifier les doublons
    const existing = await findUserLink(userId, opportunityId);

    if (existing) {
      // Mettre à jour le lien existant
      const updated = await updateUserLink(userId, opportunityId, {
        referralLink,
        targetAddress,
        paymentHash,
        sponsorId: extractedSponsorId || sponsorId
      });

      return {
        success: true,
        action: 'updated',
        message: 'Lien mis à jour avec succès',
        data: updated
      };
    }

    // 9. Vérifier si le lien est déjà utilisé par un autre utilisateur
    const linkOwner = await findUserByLink(referralLink, opportunityId);

    if (linkOwner && String(linkOwner.user_id) !== String(userId)) {
      throw new Error('Ce lien est déjà utilisé par un autre compte');
    }

    // 10. Vérifier si le lien est valide (domaine, format)
    const linkValidation = await validateLinkStructure(referralLink, opportunity);

    if (!linkValidation.valid) {
      throw new Error(linkValidation.message || 'Lien invalide');
    }

    // 11. Enregistrer le lien
    const result = await query(
      `
      INSERT INTO user_opportunities (
        user_id,
        opportunity_id,
        referral_link,
        target_address,
        payment_hash,
        sponsor_user_id,
        status,
        joined_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
      RETURNING *
      `,
      [
        userId,
        opportunityId,
        referralLink,
        targetAddress,
        paymentHash,
        extractedSponsorId || sponsorId || user.sponsor_id
      ]
    );

    // 13. Appliquer le roll-up si nécessaire
    let rollupResult = null;

    if (await isRollupNeeded(userId, opportunityId)) {
      rollupResult = await applyRollup(userId, opportunityId);
    }

    return {
      success: true,
      action: 'created',
      message: 'Lien enregistré avec succès',
      data: result.rows[0],
      rollupApplied: rollupResult ? rollupResult.rollupApplied : false,
      rollupResult
    };

  } catch (error) {
    logger.error('[FollowMe] Erreur registerUserLink:', error);
    throw error;
  }
}

/**
 * Trouve un lien d'utilisateur pour une opportunité
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<Object|null>} - Lien trouvé ou null
 */
async function findUserLink(userId, opportunityId) {
  const result = await query(
    `
    SELECT *
    FROM user_opportunities
    WHERE user_id = $1 AND opportunity_id = $2 AND status = 'active'
    `,
    [userId, opportunityId]
  );

  return result.rows[0] || null;
}

/**
 * Met à jour un lien d'utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @param {string|number} opportunityId - ID de l'opportunité
 * @param {Object} data - Données à mettre à jour
 * @returns {Promise<Object|null>} - Lien mis à jour
 */
async function updateUserLink(userId, opportunityId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (data.referralLink) {
    fields.push(`referral_link = $${paramIndex++}`);
    values.push(data.referralLink);
  }

  if (data.targetAddress) {
    fields.push(`target_address = $${paramIndex++}`);
    values.push(data.targetAddress);
  }

  if (data.paymentHash) {
    fields.push(`payment_hash = $${paramIndex++}`);
    values.push(data.paymentHash);
  }

  if (data.sponsorId) {
    fields.push(`sponsor_user_id = $${paramIndex++}`);
    values.push(data.sponsorId);
  }

  fields.push(`updated_at = NOW()`);

  values.push(userId);
  values.push(opportunityId);

  const result = await query(
    `
    UPDATE user_opportunities
    SET ${fields.join(', ')}
    WHERE user_id = $${paramIndex++} AND opportunity_id = $${paramIndex++}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

/**
 * Trouve un utilisateur par son lien pour une opportunité
 * 
 * @param {string} link - Lien à rechercher
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
 */
async function findUserByLink(link, opportunityId) {
  const result = await query(
    `
    SELECT user_id
    FROM user_opportunities
    WHERE referral_link = $1 AND opportunity_id = $2 AND status = 'active'
    `,
    [link, opportunityId]
  );

  return result.rows[0] || null;
}

/**
 * Récupère tous les liens d'un utilisateur
 * 
 * @param {string|number} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des liens
 */
async function getUserLinks(userId) {
  const result = await query(
    `
    SELECT
      uo.*,
      o.name as opportunity_name,
      o.slug as opportunity_slug
    FROM user_opportunities uo
    LEFT JOIN opportunities o ON o.id = uo.opportunity_id
    WHERE uo.user_id = $1 AND uo.status = 'active'
    ORDER BY uo.joined_at ASC
    `,
    [userId]
  );

  return result.rows;
}

/**
 * Récupère le lien disponible le plus ancien pour une opportunité (FIFO)
 * 
 * @param {string|number} opportunityId - ID de l'opportunité
 * @param {string|number} excludeUserId - ID de l'utilisateur à exclure
 * @returns {Promise<Object|null>} - Lien disponible ou null
 */
async function getAvailableLink(opportunityId, excludeUserId = null) {
  let queryText = `
    SELECT
      uo.*,
      u.email,
      u.whatsapp
    FROM user_opportunities uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.opportunity_id = $1
      AND uo.status = 'active'
  `;

  const params = [opportunityId];

  if (excludeUserId) {
    queryText += ` AND uo.user_id != $${params.length + 1}`;
    params.push(excludeUserId);
  }

  queryText += `
    ORDER BY uo.joined_at ASC
    LIMIT 1
  `;

  const result = await query(queryText, params);

  return result.rows[0] || null;
}

/**
 * Valide la structure d'un lien pour une opportunité
 * 
 * @param {string} link - Lien à valider
 * @param {Object} opportunity - Opportunité concernée
 * @returns {Promise<Object>} - Résultat de la validation
 */
async function validateLinkStructure(link, opportunity) {
  // Validation de base
  if (!link || typeof link !== 'string') {
    return { valid: false, message: 'Lien invalide' };
  }

  // Vérifier que c'est une URL valide
  if (!isValidUrl(link)) {
    return { valid: false, message: 'Format d\'URL invalide' };
  }

  try {
    const url = new URL(link);

    // Vérifier le domaine si spécifié
    if (opportunity.allowedDomains && opportunity.allowedDomains.length > 0) {
      const isDomainAllowed = opportunity.allowedDomains.some(domain =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );

      if (!isDomainAllowed) {
        return {
          valid: false,
          message: `Domaine non autorisé. Domaines acceptés : ${opportunity.allowedDomains.join(', ')}`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, message: 'URL mal formée' };
  }
}

/**
 * Extrait le sponsor depuis un lien d'opportunité
 * 
 * @param {string} link - Lien à analyser
 * @param {Object} opportunity - Opportunité concernée
 * @returns {Promise<string|number|null>} - ID du sponsor ou null
 */
async function extractSponsorFromLink(link, opportunity) {
  try {
    const url = new URL(link);

    // Extraire le code d'invitation depuis les paramètres
    const params = new URLSearchParams(url.search);
    const code = params.get('ref') || params.get('code') || params.get('invitation');

    if (code) {
      const user = await findUserByInvitationCode(code);

      if (user) {
        return user.id;
      }
    }

    // Si pas de code dans les paramètres, essayer d'extraire depuis l'URL
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart) {
      const user = await findUserByInvitationCode(lastPart);

      if (user) {
        return user.id;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Valide un lien selon les règles de validation de l'opportunité
 * 
 * @param {string} link - Lien à valider
 * @param {Object} rules - Règles de validation
 * @returns {Promise<boolean>} - True si le lien est valide
 */
async function validateLink(link, rules) {
  if (!rules) {
    return true;
  }

  // Validation par regex
  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);

    if (!regex.test(link)) {
      return false;
    }
  }

  // Validation par domaine
  if (rules.domain) {
    try {
      const url = new URL(link);
      const domain = url.hostname;

      if (domain !== rules.domain && !domain.endsWith(`.${rules.domain}`)) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  return true;
}

/**
 * Compte les liens actifs pour une opportunité
 * 
 * @param {string|number} opportunityId - ID de l'opportunité
 * @returns {Promise<number>} - Nombre de liens actifs
 */
async function countActiveLinks(opportunityId) {
  const result = await query(
    `
    SELECT COUNT(*) as count
    FROM user_opportunities
    WHERE opportunity_id = $1 AND status = 'active'
    `,
    [opportunityId]
  );

  return parseInt(result.rows[0]?.count || 0, 10);
}

module.exports = {
  registerUserLink,
  findUserLink,
  updateUserLink,
  findUserByLink,
  getUserLinks,
  getAvailableLink,
  validateLinkStructure,
  extractSponsorFromLink,
  validateLink,
  countActiveLinks
};