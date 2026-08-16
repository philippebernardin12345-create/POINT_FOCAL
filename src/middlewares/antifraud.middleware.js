/**
 * POINT FOCAL V10.4 - Middleware Antifraude
 * 
 * Protection contre les créations de comptes multiples
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 16, 18, 29
 * 
 * PRINCIPE :
 * Combine plusieurs signaux pour détecter les comportements frauduleux :
 * - Identifiant d'installation
 * - IP
 * - Fréquence des tentatives
 * - Email / WhatsApp
 * - Signaux comportementaux
 * 
 * Une IP seule ne provoque pas de blocage définitif.
 */

const { query } = require("../config/db");
const { logger } = require("../utils/logger");
const { isValidUUID } = require("../utils/validators");

// Configuration
const CONFIG = {
  MAX_ATTEMPTS_PER_HOUR: 5,
  MAX_ACCOUNTS_PER_IP: 3,
  MAX_ACCOUNTS_PER_INSTALLATION: 2,
  BLOCK_DURATION_MINUTES: 60,
  SUSPICIOUS_THRESHOLD: 3
};

/**
 * Récupère l'identifiant d'installation depuis les headers
 * 
 * @param {Request} req - Requête Express
 * @returns {string|null} - Identifiant d'installation ou null
 */
function getInstallationId(req) {
  const id = req.headers['x-installation-id'] || 
             req.headers['x-device-id'] ||
             req.headers['installation-id'];
  
  if (id && typeof id === 'string' && id.length > 0) {
    return id;
  }
  
  return null;
}

/**
 * Récupère l'IP du client
 * 
 * @param {Request} req - Requête Express
 * @returns {string} - IP du client
 */
function getClientIp(req) {
  return req.ip || 
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         'unknown';
}

/**
 * Vérifie si une installation a déjà créé des comptes
 * 
 * @param {string} installationId - Identifiant d'installation
 * @param {string} email - Email à vérifier
 * @param {string} whatsapp - WhatsApp à vérifier
 * @returns {Promise<Object>} - Résultat de la vérification
 */
async function checkInstallation(installationId, email, whatsapp) {
  if (!installationId) {
    return { allowed: true, score: 0 };
  }

  try {
    // Compter les comptes créés avec cette installation
    const result = await query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT email) as unique_emails,
        COUNT(DISTINCT whatsapp) as unique_whatsapps
      FROM antifraud_logs
      WHERE installation_id = $1
        AND action = 'register_attempt'
        AND created_at > NOW() - INTERVAL '24 hours'
      `,
      [installationId]
    );

    const total = parseInt(result.rows[0]?.total || 0, 10);
    const uniqueEmails = parseInt(result.rows[0]?.unique_emails || 0, 10);
    const uniqueWhatsapps = parseInt(result.rows[0]?.unique_whatsapps || 0, 10);

    let score = 0;
    let reasons = [];

    // Trop de tentatives
    if (total > CONFIG.MAX_ATTEMPTS_PER_HOUR) {
      score += 2;
      reasons.push('Trop de tentatives');
    }

    // Trop de comptes par installation
    if (uniqueEmails > CONFIG.MAX_ACCOUNTS_PER_INSTALLATION) {
      score += 3;
      reasons.push('Trop de comptes pour cette installation');
    }

    // Même email déjà utilisé
    if (email) {
      const emailCheck = await query(
        `
        SELECT id FROM antifraud_logs
        WHERE installation_id = $1 AND email = $2
        `,
        [installationId, email.toLowerCase().trim()]
      );

      if (emailCheck.rows.length > 0) {
        score += 1;
        reasons.push('Email déjà utilisé avec cette installation');
      }
    }

    // Même WhatsApp déjà utilisé
    if (whatsapp) {
      const whatsappCheck = await query(
        `
        SELECT id FROM antifraud_logs
        WHERE installation_id = $1 AND whatsapp = $2
        `,
        [installationId, whatsapp.trim()]
      );

      if (whatsappCheck.rows.length > 0) {
        score += 1;
        reasons.push('WhatsApp déjà utilisé avec cette installation');
      }
    }

    return {
      allowed: score < CONFIG.SUSPICIOUS_THRESHOLD,
      score,
      reasons,
      total,
      uniqueEmails,
      uniqueWhatsapps
    };
  } catch (error) {
    logger.error('[Antifraud] Erreur checkInstallation:', error);
    return { allowed: true, score: 0 };
  }
}

/**
 * Vérifie l'IP du client
 * 
 * @param {string} ip - IP du client
 * @param {string} email - Email à vérifier
 * @param {string} whatsapp - WhatsApp à vérifier
 * @returns {Promise<Object>} - Résultat de la vérification
 */
async function checkIp(ip, email, whatsapp) {
  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
    return { allowed: true, score: 0 };
  }

  try {
    // Compter les comptes créés avec cette IP
    const result = await query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT email) as unique_emails
      FROM antifraud_logs
      WHERE ip = $1
        AND action = 'register_attempt'
        AND created_at > NOW() - INTERVAL '24 hours'
      `,
      [ip]
    );

    const total = parseInt(result.rows[0]?.total || 0, 10);
    const uniqueEmails = parseInt(result.rows[0]?.unique_emails || 0, 10);

    let score = 0;
    let reasons = [];

    // Trop de tentatives
    if (total > CONFIG.MAX_ATTEMPTS_PER_HOUR * 2) {
      score += 1;
      reasons.push('Trop de tentatives depuis cette IP');
    }

    // Trop de comptes par IP
    if (uniqueEmails > CONFIG.MAX_ACCOUNTS_PER_IP) {
      score += 2;
      reasons.push('Trop de comptes pour cette IP');
    }

    return {
      allowed: score < CONFIG.SUSPICIOUS_THRESHOLD,
      score,
      reasons,
      total,
      uniqueEmails
    };
  } catch (error) {
    logger.error('[Antifraud] Erreur checkIp:', error);
    return { allowed: true, score: 0 };
  }
}

/**
 * Vérifie la fréquence des tentatives
 * 
 * @param {string} email - Email à vérifier
 * @param {string} whatsapp - WhatsApp à vérifier
 * @param {string} ip - IP du client
 * @returns {Promise<Object>} - Résultat de la vérification
 */
async function checkFrequency(email, whatsapp, ip) {
  try {
    // Vérifier les tentatives récentes
    const result = await query(
      `
      SELECT COUNT(*) as count
      FROM antifraud_logs
      WHERE (email = $1 OR whatsapp = $2 OR ip = $3)
        AND action = 'register_attempt'
        AND created_at > NOW() - INTERVAL '1 hour'
      `,
      [
        email ? email.toLowerCase().trim() : null,
        whatsap ? whatsapp.trim() : null,
        ip
      ]
    );

    const count = parseInt(result.rows[0]?.count || 0, 10);

    if (count > CONFIG.MAX_ATTEMPTS_PER_HOUR * 2) {
      return {
        allowed: false,
        score: 3,
        reason: 'Trop de tentatives récentes',
        attempts: count
      };
    }

    return {
      allowed: true,
      score: 0,
      attempts: count
    };
  } catch (error) {
    logger.error('[Antifraud] Erreur checkFrequency:', error);
    return { allowed: true, score: 0 };
  }
}

/**
 * Journalise une tentative
 * 
 * @param {Object} data - Données à journaliser
 * @param {string} data.installationId - Identifiant d'installation
 * @param {string} data.ip - IP du client
 * @param {string} data.email - Email
 * @param {string} data.whatsapp - WhatsApp
 * @param {string} data.action - Action effectuée
 * @param {number} data.score - Score de risque
 * @param {boolean} data.blocked - Si la tentative a été bloquée
 */
async function logAttempt({ installationId, ip, email, whatsapp, action = 'register_attempt', score = 0, blocked = false }) {
  try {
    await query(
      `
      INSERT INTO antifraud_logs (
        installation_id,
        ip,
        email,
        whatsapp,
        action,
        score,
        blocked,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      [
        installationId || null,
        ip || null,
        email ? email.toLowerCase().trim() : null,
        whatsapp ? whatsapp.trim() : null,
        action,
        score,
        blocked
      ]
    );
  } catch (error) {
    logger.error('[Antifraud] Erreur logAttempt:', error);
  }
}

/**
 * Middleware de vérification antifraude pour les inscriptions
 * 
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {NextFunction} next - Fonction suivante
 */
async function antifraudMiddleware(req, res, next) {
  try {
    // Ignorer en développement
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_ANTIFRAUD === 'true') {
      return next();
    }

    const installationId = getInstallationId(req);
    const ip = getClientIp(req);
    const { email, whatsapp } = req.body;

    // Vérifier l'installation
    if (installationId) {
      const installationCheck = await checkInstallation(installationId, email, whatsapp);

      if (!installationCheck.allowed) {
        await logAttempt({
          installationId,
          ip,
          email,
          whatsapp,
          action: 'register_attempt',
          score: installationCheck.score,
          blocked: true
        });

        return res.status(403).json({
          success: false,
          message: 'Tentative détectée. Veuillez contacter le support.',
          code: 'ANTIFRAUD_BLOCKED',
          reasons: installationCheck.reasons
        });
      }
    }

    // Vérifier l'IP
    const ipCheck = await checkIp(ip, email, whatsapp);

    if (!ipCheck.allowed) {
      await logAttempt({
        installationId,
        ip,
        email,
        whatsapp,
        action: 'register_attempt',
        score: ipCheck.score,
        blocked: true
      });

      return res.status(403).json({
        success: false,
        message: 'Tentative détectée. Veuillez contacter le support.',
        code: 'ANTIFRAUD_BLOCKED',
        reasons: ipCheck.reasons
      });
    }

    // Vérifier la fréquence
    const frequencyCheck = await checkFrequency(email, whatsapp, ip);

    if (!frequencyCheck.allowed) {
      await logAttempt({
        installationId,
        ip,
        email,
        whatsapp,
        action: 'register_attempt',
        score: frequencyCheck.score,
        blocked: true
      });

      return res.status(429).json({
        success: false,
        message: 'Trop de tentatives. Veuillez réessayer plus tard.',
        code: 'RATE_LIMIT_ANTIFRAUD'
      });
    }

    // Calculer le score total
    const totalScore = (installationId ? 0 : 0) + (ipCheck.score || 0) + (frequencyCheck.score || 0);

    // Journaliser la tentative
    await logAttempt({
      installationId,
      ip,
      email,
      whatsapp,
      action: 'register_attempt',
      score: totalScore,
      blocked: false
    });

    // Ajouter les informations à la requête pour une éventuelle utilisation ultérieure
    req.antifraud = {
      installationId,
      ip,
      score: totalScore,
      passed: true
    };

    next();
  } catch (error) {
    logger.error('[Antifraud] Erreur middleware:', error);
    // En cas d'erreur, on laisse passer pour ne pas bloquer les utilisateurs
    next();
  }
}

/**
 * Middleware de limitation pour les routes sensibles
 * 
 * @param {Object} options - Options de limitation
 * @param {number} options.windowMs - Fenêtre de temps (ms)
 * @param {number} options.max - Nombre maximum de requêtes
 */
function rateLimitMiddleware(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute par défaut
  const max = options.max || 10;

  const requests = new Map();

  return function(req, res, next) {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requests.has(key)) {
      requests.set(key, []);
    }

    const timestamps = requests.get(key);
    const windowStart = now - windowMs;

    // Filtrer les requêtes hors fenêtre
    const validRequests = timestamps.filter(t => t > windowStart);
    validRequests.push(now);
    requests.set(key, validRequests);

    if (validRequests.length > max) {
      return res.status(429).json({
        success: false,
        message: 'Trop de requêtes. Veuillez réessayer plus tard.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    next();
  };
}

module.exports = {
  antifraudMiddleware,
  rateLimitMiddleware,
  getInstallationId,
  getClientIp,
  checkInstallation,
  checkIp,
  checkFrequency,
  logAttempt
};