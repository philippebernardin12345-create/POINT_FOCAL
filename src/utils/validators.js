/**
 * POINT FOCAL V10.4 - Validateurs
 * 
 * Fonctions de validation pour les données d'entrée
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 8, 35
 */

/**
 * Valide une adresse email
 * 
 * @param {string} email - Email à valider
 * @returns {boolean} - True si l'email est valide
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Valide un numéro WhatsApp
 * 
 * @param {string} whatsapp - Numéro à valider
 * @returns {boolean} - True si le numéro est valide
 */
function isValidWhatsApp(whatsapp) {
  if (!whatsapp || typeof whatsapp !== "string") {
    return false;
  }

  // Format : 243XXXXXXXXX (9 chiffres après l'indicatif)
  const cleaned = whatsapp.replace(/\s+/g, "").replace(/^\+/, "");
  const whatsappRegex = /^[0-9]{10,15}$/;
  
  return whatsappRegex.test(cleaned);
}

/**
 * Valide un mot de passe
 * 
 * @param {string} password - Mot de passe à valider
 * @param {number} minLength - Longueur minimale (défaut: 6)
 * @returns {boolean} - True si le mot de passe est valide
 */
function isValidPassword(password, minLength = 6) {
  if (!password || typeof password !== "string") {
    return false;
  }

  return password.length >= minLength;
}

/**
 * Valide une URL
 * 
 * @param {string} url - URL à valider
 * @param {Array<string>} allowedProtocols - Protocoles autorisés (défaut: ['http:', 'https:'])
 * @returns {boolean} - True si l'URL est valide
 */
function isValidUrl(url, allowedProtocols = ['http:', 'https:']) {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

/**
 * Valide une adresse blockchain (Ethereum/BNB)
 * 
 * @param {string} address - Adresse à valider
 * @returns {boolean} - True si l'adresse est valide
 */
function isValidBlockchainAddress(address) {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Format : 0x + 40 caractères hexadécimaux
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address.trim());
}

/**
 * Valide un hash de transaction blockchain
 * 
 * @param {string} hash - Hash à valider
 * @returns {boolean} - True si le hash est valide
 */
function isValidTransactionHash(hash) {
  if (!hash || typeof hash !== "string") {
    return false;
  }

  // Format : 0x + 64 caractères hexadécimaux
  const hashRegex = /^0x[a-fA-F0-9]{64}$/;
  return hashRegex.test(hash.trim().toLowerCase());
}

/**
 * Valide une langue
 * 
 * @param {string} language - Code langue à valider
 * @returns {boolean} - True si la langue est supportée
 */
function isValidLanguage(language) {
  const supportedLanguages = ['fr', 'en', 'es', 'pt', 'ar', 'hi'];
  return supportedLanguages.includes(language);
}

/**
 * Valide une date
 * 
 * @param {string|Date} date - Date à valider
 * @returns {boolean} - True si la date est valide
 */
function isValidDate(date) {
  if (!date) {
    return false;
  }

  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Valide un UUID
 * 
 * @param {string} uuid - UUID à valider
 * @returns {boolean} - True si l'UUID est valide
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== "string") {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valide un montant
 * 
 * @param {number|string} amount - Montant à valider
 * @param {number} min - Montant minimum (défaut: 0)
 * @param {number} max - Montant maximum (défaut: Infinity)
 * @returns {boolean} - True si le montant est valide
 */
function isValidAmount(amount, min = 0, max = Infinity) {
  if (amount === null || amount === undefined) {
    return false;
  }

  const num = Number(amount);
  
  if (isNaN(num)) {
    return false;
  }

  return num >= min && num <= max;
}

/**
 * Valide un code d'invitation
 * 
 * @param {string} code - Code à valider
 * @returns {boolean} - True si le code est valide
 */
function isValidInvitationCode(code) {
  if (!code || typeof code !== "string") {
    return false;
  }

  // Format : 4 lettres + 4 chiffres
  const codeRegex = /^[A-Z]{4}[0-9]{4}$/;
  return codeRegex.test(code.toUpperCase().trim());
}

/**
 * Valide un nom d'utilisateur
 * 
 * @param {string} username - Nom d'utilisateur à valider
 * @param {number} minLength - Longueur minimale (défaut: 3)
 * @param {number} maxLength - Longueur maximale (défaut: 30)
 * @returns {boolean} - True si le nom est valide
 */
function isValidUsername(username, minLength = 3, maxLength = 30) {
  if (!username || typeof username !== "string") {
    return false;
  }

  const trimmed = username.trim();
  
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return false;
  }

  // Alphanumérique, tiret, underscore
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  return usernameRegex.test(trimmed);
}

/**
 * Nettoie une chaîne de caractères
 * 
 * @param {string} input - Chaîne à nettoyer
 * @param {Object} options - Options de nettoyage
 * @param {boolean} options.trim - Supprimer les espaces (défaut: true)
 * @param {boolean} options.lowercase - Mettre en minuscules (défaut: false)
 * @param {boolean} options.uppercase - Mettre en majuscules (défaut: false)
 * @param {boolean} options.removeSpecialChars - Supprimer les caractères spéciaux (défaut: false)
 * @returns {string} - Chaîne nettoyée
 */
function sanitizeString(input, options = {}) {
  if (!input || typeof input !== "string") {
    return "";
  }

  let result = input;

  if (options.trim !== false) {
    result = result.trim();
  }

  if (options.lowercase) {
    result = result.toLowerCase();
  }

  if (options.uppercase) {
    result = result.toUpperCase();
  }

  if (options.removeSpecialChars) {
    result = result.replace(/[^a-zA-Z0-9]/g, "");
  }

  return result;
}

/**
 * Valide la structure d'un lien d'opportunité
 * 
 * @param {string} link - Lien à valider
 * @param {Object} rules - Règles de validation
 * @param {string} rules.domain - Domaine autorisé
 * @param {string} rules.pattern - Pattern regex
 * @param {Array<string>} rules.allowedDomains - Domaines autorisés
 * @returns {Object} - Résultat de la validation
 */
function validateOpportunityLink(link, rules = {}) {
  // Validation de base
  if (!isValidUrl(link)) {
    return { valid: false, message: "Format d'URL invalide" };
  }

  try {
    const url = new URL(link);

    // Vérifier le domaine
    if (rules.domain) {
      const domain = url.hostname;
      if (domain !== rules.domain && !domain.endsWith(`.${rules.domain}`)) {
        return { 
          valid: false, 
          message: `Domaine non autorisé. Attendu: ${rules.domain}` 
        };
      }
    }

    // Vérifier les domaines autorisés
    if (rules.allowedDomains && rules.allowedDomains.length > 0) {
      const domain = url.hostname;
      const isAllowed = rules.allowedDomains.some(d => 
        domain === d || domain.endsWith(`.${d}`)
      );

      if (!isAllowed) {
        return { 
          valid: false, 
          message: `Domaine non autorisé. Domaines acceptés: ${rules.allowedDomains.join(', ')}` 
        };
      }
    }

    // Vérifier le pattern
    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(link)) {
        return { valid: false, message: "Format de lien invalide" };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, message: "URL mal formée" };
  }
}

/**
 * Valide un numéro de téléphone (format international)
 * 
 * @param {string} phone - Numéro à valider
 * @returns {boolean} - True si le numéro est valide
 */
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");
  const phoneRegex = /^[0-9]{8,15}$/;
  return phoneRegex.test(cleaned);
}

module.exports = {
  isValidEmail,
  isValidWhatsApp,
  isValidPassword,
  isValidUrl,
  isValidBlockchainAddress,
  isValidTransactionHash,
  isValidLanguage,
  isValidDate,
  isValidUUID,
  isValidAmount,
  isValidInvitationCode,
  isValidUsername,
  sanitizeString,
  validateOpportunityLink,
  isValidPhoneNumber
};