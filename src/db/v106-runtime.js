"use strict";

/**
 * v106-runtime.js
 * Accès au singleton v106_runtime_state et à l'utilisateur root V10.6.
 *
 * NOTE : users.is_root reste LEGACY. Le root V10.6 est représenté
 * par v106_runtime_state.root_user_id.
 */

const { query, withTransaction } = require("../config/db");

/**
 * Lire l'état complet du singleton runtime.
 * @returns {Object} ligne v106_runtime_state
 */
async function getRuntimeState() {
  const res = await query(
    "SELECT * FROM v106_runtime_state WHERE singleton_id = 1"
  );
  if (res.rowCount === 0) {
    throw new Error("v106_runtime_state singleton absent — migration non appliquée ?");
  }
  return res.rows[0];
}

/**
 * Définir l'utilisateur root V10.6.
 * Ne modifie PAS users.is_root (legacy).
 * @param {string} userId - UUID de l'utilisateur root
 */
async function setRootUser(userId) {
  // Vérifier que l'utilisateur existe
  const check = await query("SELECT id FROM users WHERE id = $1", [userId]);
  if (check.rowCount === 0) {
    throw new Error(`Utilisateur introuvable : ${userId}`);
  }

  await query(
    `UPDATE v106_runtime_state
     SET    root_user_id = $1,
            updated_at   = NOW()
     WHERE  singleton_id = 1`,
    [userId]
  );
}

/**
 * Résoudre l'utilisateur root V10.6 actuel.
 * Priorité : root_user_id du singleton → colonne legacy is_root.
 * @returns {Object|null} utilisateur ou null
 */
async function resolveRootUser() {
  const state = await getRuntimeState();

  if (state.root_user_id) {
    const res = await query("SELECT * FROM users WHERE id = $1", [state.root_user_id]);
    return res.rows[0] || null;
  }

  // Repli sur legacy is_root
  const fallback = await query("SELECT * FROM users WHERE is_root = TRUE LIMIT 1");
  return fallback.rows[0] || null;
}

/**
 * Déclencher la transition de phase via la fonction SQL atomique.
 * @returns {string} résultat : 'transitioned' | 'threshold_not_reached' | 'already_normal_operation'
 */
async function transitionPhaseToNormalOperation() {
  const res = await query("SELECT v106_transition_phase_to_normal_operation() AS result");
  return res.rows[0].result;
}

/**
 * Attribuer un parrain global via la fonction SQL atomique.
 * @param {string} sponsorId - UUID du parrain
 * @param {string} childId   - UUID de l'enfant
 * @returns {number} numéro de slot attribué (1 ou 2)
 */
async function assignGlobalSponsor(sponsorId, childId) {
  const res = await query(
    "SELECT slot_no FROM v106_assign_global_sponsor($1, $2)",
    [sponsorId, childId]
  );
  return res.rows[0].slot_no;
}

module.exports = {
  getRuntimeState,
  setRootUser,
  resolveRootUser,
  transitionPhaseToNormalOperation,
  assignGlobalSponsor
};
