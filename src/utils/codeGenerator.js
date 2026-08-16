/**
 * POINT FOCAL V10.4 - Générateur de code d'invitation
 * 
 * Format : ABCD1000 (4 lettres + 4 chiffres)
 * 
 * RÉFÉRENCE : Constitution Technique V10.4 - Article 16, 27
 * 
 * Les anciennes notions de "Série 1 / Série 2 / Série 3" sont supprimées.
 * Il n'existe plus qu'un seul format de code d'invitation.
 */

/**
 * Génère une chaîne de lettres aléatoires
 * 
 * @param {number} length - Nombre de lettres (défaut: 4)
 * @returns {string} - Chaîne de lettres majuscules
 */
function generateLetters(length = 4) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    result += letters[randomIndex];
  }

  return result;
}

/**
 * Génère une chaîne de chiffres aléatoires
 * 
 * @param {number} length - Nombre de chiffres (défaut: 4)
 * @returns {string} - Chaîne de chiffres
 */
function generateDigits(length = 4) {
  let result = "";

  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }

  // Évite les codes trop simples ou prévisibles
  const forbiddenPatterns = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "5678", "8765"];

  if (forbiddenPatterns.includes(result)) {
    return generateDigits(length);
  }

  return result;
}

/**
 * Génère un code d'invitation au format ABCD1000
 * 
 * @param {Object} options - Options de génération
 * @param {number} options.letterLength - Nombre de lettres (défaut: 4)
 * @param {number} options.digitLength - Nombre de chiffres (défaut: 4)
 * @param {boolean} options.avoidConfusion - Évite les lettres confusables (I, O, 0, 1)
 * @returns {string} - Code d'invitation
 */
function generateInvitationCode(options = {}) {
  const letterLength = options.letterLength || 4;
  const digitLength = options.digitLength || 4;
  const avoidConfusion = options.avoidConfusion !== false;

  let letters = generateLetters(letterLength);

  // Évite les lettres confusables : I, O (peuvent être confondues avec 1, 0)
  if (avoidConfusion) {
    const confusionMap = {
      'I': 'A',
      'O': 'P'
    };

    letters = letters.split('').map(char => {
      return confusionMap[char] || char;
    }).join('');
  }

  const digits = generateDigits(digitLength);

  return `${letters}${digits}`;
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

  // Format : 4 lettres majuscules + 4 chiffres
  // Accepte aussi les minuscules (converties en majuscules)
  const normalized = code.toUpperCase().trim();
  return /^[A-Z]{4}[0-9]{4}$/.test(normalized);
}

/**
 * Normalise un code d'invitation
 * 
 * @param {string} code - Code à normaliser
 * @returns {string} - Code normalisé (majuscules, sans espaces)
 */
function normalizeInvitationCode(code) {
  if (!code) {
    return "";
  }

  return String(code)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Extrait la partie lettres d'un code d'invitation
 * 
 * @param {string} code - Code d'invitation
 * @returns {string} - Partie lettres
 */
function extractLetters(code) {
  const normalized = normalizeInvitationCode(code);
  return normalized.substring(0, 4);
}

/**
 * Extrait la partie chiffres d'un code d'invitation
 * 
 * @param {string} code - Code d'invitation
 * @returns {string} - Partie chiffres
 */
function extractDigits(code) {
  const normalized = normalizeInvitationCode(code);
  return normalized.substring(4, 8);
}

/**
 * Vérifie si deux codes d'invitation sont identiques
 * 
 * @param {string} code1 - Premier code
 * @param {string} code2 - Deuxième code
 * @returns {boolean} - True si les codes sont identiques
 */
function areInvitationCodesEqual(code1, code2) {
  return normalizeInvitationCode(code1) === normalizeInvitationCode(code2);
}

/**
 * Génère plusieurs codes d'invitation uniques
 * 
 * @param {number} count - Nombre de codes à générer
 * @param {Function} existsCheck - Fonction pour vérifier si un code existe déjà
 * @param {Object} options - Options de génération
 * @returns {Promise<string[]>} - Liste des codes uniques
 */
async function generateUniqueInvitationCodes(count = 1, existsCheck = null, options = {}) {
  const codes = [];
  const maxAttempts = 100;

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let code = null;

    while (attempts < maxAttempts) {
      const candidate = generateInvitationCode(options);
      const normalized = normalizeInvitationCode(candidate);

      // Vérifier les doublons dans la liste générée
      const isDuplicateInList = codes.some(c => areInvitationCodesEqual(c, normalized));

      if (isDuplicateInList) {
        attempts++;
        continue;
      }

      // Vérifier l'existence via la fonction de callback (si fournie)
      if (existsCheck) {
        const exists = await existsCheck(normalized);
        if (exists) {
          attempts++;
          continue;
        }
      }

      code = normalized;
      break;
    }

    if (!code) {
      throw new Error(`Impossible de générer un code unique après ${maxAttempts} tentatives.`);
    }

    codes.push(code);
  }

  return codes;
}

/**
 * Décode un lien d'invitation pour en extraire le code
 * 
 * @param {string} link - Lien d'invitation (ex: https://pointfocal.com/register?ref=ABCD1000)
 * @returns {string|null} - Code d'invitation extrait ou null
 */
function extractCodeFromLink(link) {
  if (!link || typeof link !== "string") {
    return null;
  }

  try {
    const url = new URL(link);
    const params = new URLSearchParams(url.search);

    // Chercher le paramètre 'ref' ou 'code' ou 'invitation'
    const code = params.get('ref') || params.get('code') || params.get('invitation');

    if (code && isValidInvitationCode(code)) {
      return normalizeInvitationCode(code);
    }

    // Si pas de paramètre, essayer de trouver un code dans l'URL
    const pathParts = url.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (isValidInvitationCode(part)) {
        return normalizeInvitationCode(part);
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Construit un lien d'invitation à partir d'un code
 * 
 * @param {string} code - Code d'invitation
 * @param {string} baseUrl - URL de base (défaut: https://pointfocal.com)
 * @returns {string} - Lien d'invitation complet
 */
function buildInvitationLink(code, baseUrl = "https://pointfocal.com") {
  const normalized = normalizeInvitationCode(code);

  if (!isValidInvitationCode(normalized)) {
    throw new Error("Code d'invitation invalide.");
  }

  return `${baseUrl}/register.html?ref=${encodeURIComponent(normalized)}`;
}

module.exports = {
  generateInvitationCode,
  isValidInvitationCode,
  normalizeInvitationCode,
  extractLetters,
  extractDigits,
  areInvitationCodesEqual,
  generateUniqueInvitationCodes,
  extractCodeFromLink,
  buildInvitationLink,
  // Exports pour compatibilité
  generateLetters,
  generateDigits
};