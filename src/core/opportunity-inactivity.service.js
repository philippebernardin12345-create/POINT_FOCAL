const db = require("../config/db");

const RESULT = Object.freeze({ ACTIVE: "active", INDETERMINATE: "indeterminate", CONFIRMED: "confirmed" });
const INACTIVE_HTTP = new Set([404, 410]);
const ACTIVE_HTTP = new Set([200, 201, 202, 203, 204]);

function classifyHttp({ status, body = "" }) {
  if (INACTIVE_HTTP.has(status)) return RESULT.CONFIRMED;
  if (status >= 500 || status === 408 || status === 425 || status === 429) return RESULT.INDETERMINATE;
  const text = String(body).toLowerCase();
  const markers = ["account not found", "user not found", "profile not found", "account has been deleted", "account deleted", "compte introuvable", "utilisateur introuvable", "compte supprimé", "cuenta eliminada", "usuario no encontrado", "conta excluída", "usuário não encontrado"];
  if (markers.some((m) => text.includes(m))) return RESULT.CONFIRMED;
  if (ACTIVE_HTTP.has(status)) return RESULT.ACTIVE;
  return RESULT.INDETERMINATE;
}

async function fetchPublicLink(url, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("HTTP_FETCH_UNAVAILABLE");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "PointFocal-LinkVerifier/1.0" } });
    return { status: response.status, finalUrl: response.url || url, body: (await response.text()).slice(0, 250000) };
  } finally { clearTimeout(timeout); }
}

/*
 * Le signaleur est le membre qui a reçu un placement dans l'opportunité.
 * Le compte signalé est son sponsor_user_id dans CETTE opportunité.
 * Le lien vérifié appartient au compte signalé, jamais au signaleur.
 */
async function getAssignedReceiver(client, reporterUserId, opportunityId) {
  const placement = await client.query(
    `SELECT sponsor_user_id
       FROM user_opportunities
      WHERE user_id=$1 AND opportunity_id=$2 AND status='active'
      LIMIT 1`,
    [reporterUserId, opportunityId]
  );
  const unavailableUserId = placement.rows[0]?.sponsor_user_id;
  if (!unavailableUserId) return null;

  const owner = await client.query(
    `SELECT user_id, referral_link
       FROM user_opportunities
      WHERE user_id=$1 AND opportunity_id=$2
        AND referral_link IS NOT NULL
      LIMIT 1`,
    [unavailableUserId, opportunityId]
  );
  if (!owner.rows[0]) return null;
  return { unavailableUserId: owner.rows[0].user_id, assignedReferralLink: owner.rows[0].referral_link };
}

async function saveState(client, { reporterUserId, unavailableUserId, opportunityId, state, method, detail, assignedReferralLink }) {
  const result = await client.query(
    `INSERT INTO opportunity_inactivity_confirmations
       (user_id, opportunity_id, state, checked_at, confirmed_at, restored_at, verification_method, verification_detail, updated_at,
        reporter_user_id, assigned_referral_link)
     VALUES ($1,$2,$3,NOW(),CASE WHEN $3='confirmed' THEN NOW() END,CASE WHEN $3='restored' THEN NOW() END,$4,$5,NOW(),$6,$7)
     ON CONFLICT (user_id, opportunity_id)
     DO UPDATE SET state=EXCLUDED.state, checked_at=NOW(),
       confirmed_at=CASE WHEN EXCLUDED.state='confirmed' THEN NOW() ELSE opportunity_inactivity_confirmations.confirmed_at END,
       restored_at=CASE WHEN EXCLUDED.state='restored' THEN NOW() ELSE opportunity_inactivity_confirmations.restored_at END,
       verification_method=EXCLUDED.verification_method, verification_detail=EXCLUDED.verification_detail,
       reporter_user_id=EXCLUDED.reporter_user_id, assigned_referral_link=EXCLUDED.assigned_referral_link, updated_at=NOW()
     RETURNING *`,
    [unavailableUserId, opportunityId, state, method, detail, reporterUserId, assignedReferralLink]
  );
  return result.rows[0];
}

async function reportAndVerify({ reporterUserId, opportunityId, fetchImpl = global.fetch }) {
  return db.withTransaction(async (client) => {
    const assigned = await getAssignedReceiver(client, reporterUserId, opportunityId);
    if (!assigned) throw new Error("ASSIGNED_RECEIVER_LINK_NOT_FOUND");
    const { unavailableUserId, assignedReferralLink } = assigned;

    await client.query(
      `INSERT INTO opportunity_inactivity_confirmations
         (user_id, opportunity_id, state, reported_at, updated_at, reporter_user_id, assigned_referral_link)
       VALUES ($1,$2,'reported',NOW(),NOW(),$3,$4)
       ON CONFLICT (user_id, opportunity_id)
       DO UPDATE SET state='reported', reported_at=NOW(), reporter_user_id=EXCLUDED.reporter_user_id,
                     assigned_referral_link=EXCLUDED.assigned_referral_link, updated_at=NOW()`,
      [unavailableUserId, opportunityId, reporterUserId, assignedReferralLink]
    );

    let probe;
    try { probe = await fetchPublicLink(assignedReferralLink, fetchImpl); }
    catch (err) {
      const record = await saveState(client, { reporterUserId, unavailableUserId, opportunityId, state: "reported", method: "http-public-link", detail: `indeterminate:${err.name || "error"}`, assignedReferralLink });
      return { result: RESULT.INDETERMINATE, unavailableUserId, record };
    }

    const result = classifyHttp(probe);
    const state = result === RESULT.CONFIRMED ? "confirmed" : result === RESULT.ACTIVE ? "rejected" : "reported";
    const detail = `${result}:status=${probe.status};final=${probe.finalUrl}`;
    const record = await saveState(client, { reporterUserId, unavailableUserId, opportunityId, state, method: "http-public-link", detail, assignedReferralLink });
    return { result, unavailableUserId, record };
  });
}

module.exports = { RESULT, classifyHttp, fetchPublicLink, getAssignedReceiver, reportAndVerify };
