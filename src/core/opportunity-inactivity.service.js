const db = require("../config/db");

const RESULT = Object.freeze({
  ACTIVE: "active",
  INDETERMINATE: "indeterminate",
  CONFIRMED: "confirmed"
});

const INACTIVE_HTTP = new Set([404, 410]);
const ACTIVE_HTTP = new Set([200, 201, 202, 203, 204]);

function classifyHttp({ status, finalUrl, originalUrl, body = "" }) {
  if (INACTIVE_HTTP.has(status)) return RESULT.CONFIRMED;
  if (status >= 500 || status === 408 || status === 425 || status === 429) {
    return RESULT.INDETERMINATE;
  }

  const text = String(body).toLowerCase();
  const explicitInactiveMarkers = [
    "account not found",
    "user not found",
    "profile not found",
    "account has been deleted",
    "account deleted",
    "compte introuvable",
    "utilisateur introuvable",
    "compte supprimé",
    "cuenta eliminada",
    "usuario no encontrado",
    "conta excluída",
    "usuário não encontrado"
  ];

  if (explicitInactiveMarkers.some((marker) => text.includes(marker))) {
    return RESULT.CONFIRMED;
  }

  if (ACTIVE_HTTP.has(status)) return RESULT.ACTIVE;

  // Une redirection, un 401/403 ou toute réponse ambiguë ne prouve jamais
  // automatiquement la suppression d'un compte.
  return RESULT.INDETERMINATE;
}

async function fetchPublicLink(url, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("HTTP_FETCH_UNAVAILABLE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "PointFocal-LinkVerifier/1.0" }
    });
    const body = await response.text();
    return {
      status: response.status,
      finalUrl: response.url || url,
      originalUrl: url,
      body: body.slice(0, 250000)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getOwnedReferralLink(client, userId, opportunityId) {
  const result = await client.query(
    `SELECT referral_link
       FROM user_opportunities
      WHERE user_id = $1
        AND opportunity_id = $2
        AND status = 'active'
        AND referral_link IS NOT NULL
      LIMIT 1`,
    [userId, opportunityId]
  );
  return result.rows[0]?.referral_link || null;
}

async function saveState(client, { userId, opportunityId, state, method, detail }) {
  const confirmed = state === "confirmed";
  const restored = state === "restored";
  const result = await client.query(
    `INSERT INTO opportunity_inactivity_confirmations
       (user_id, opportunity_id, state, checked_at, confirmed_at, restored_at,
        verification_method, verification_detail, updated_at)
     VALUES ($1,$2,$3,NOW(),CASE WHEN $3='confirmed' THEN NOW() END,
             CASE WHEN $3='restored' THEN NOW() END,$4,$5,NOW())
     ON CONFLICT (user_id, opportunity_id)
     DO UPDATE SET state = EXCLUDED.state,
                   checked_at = NOW(),
                   confirmed_at = CASE WHEN EXCLUDED.state='confirmed' THEN NOW() ELSE opportunity_inactivity_confirmations.confirmed_at END,
                   restored_at = CASE WHEN EXCLUDED.state='restored' THEN NOW() ELSE opportunity_inactivity_confirmations.restored_at END,
                   verification_method = EXCLUDED.verification_method,
                   verification_detail = EXCLUDED.verification_detail,
                   updated_at = NOW()
     RETURNING *`,
    [userId, opportunityId, state, method, detail]
  );
  return result.rows[0];
}

async function reportAndVerify({ userId, opportunityId, fetchImpl = global.fetch }) {
  return db.withTransaction(async (client) => {
    const link = await getOwnedReferralLink(client, userId, opportunityId);
    if (!link) throw new Error("OPPORTUNITY_REFERRAL_LINK_NOT_FOUND");

    // Le signalement est toujours persisté avant toute vérification.
    await client.query(
      `INSERT INTO opportunity_inactivity_confirmations
         (user_id, opportunity_id, state, reported_at, updated_at)
       VALUES ($1,$2,'reported',NOW(),NOW())
       ON CONFLICT (user_id, opportunity_id)
       DO UPDATE SET state='reported', reported_at=NOW(), updated_at=NOW()`,
      [userId, opportunityId]
    );

    let probe;
    try {
      probe = await fetchPublicLink(link, fetchImpl);
    } catch (err) {
      const row = await saveState(client, {
        userId,
        opportunityId,
        state: "reported",
        method: "http-public-link",
        detail: `indeterminate:${err.name || "error"}`
      });
      return { result: RESULT.INDETERMINATE, record: row };
    }

    const result = classifyHttp(probe);
    if (result === RESULT.CONFIRMED) {
      const row = await saveState(client, {
        userId, opportunityId, state: "confirmed", method: "http-public-link",
        detail: `status=${probe.status};final=${probe.finalUrl}`
      });
      return { result, record: row };
    }

    if (result === RESULT.ACTIVE) {
      const row = await saveState(client, {
        userId, opportunityId, state: "rejected", method: "http-public-link",
        detail: `active:status=${probe.status};final=${probe.finalUrl}`
      });
      return { result, record: row };
    }

    const row = await saveState(client, {
      userId, opportunityId, state: "reported", method: "http-public-link",
      detail: `indeterminate:status=${probe.status};final=${probe.finalUrl}`
    });
    return { result: RESULT.INDETERMINATE, record: row };
  });
}

module.exports = { RESULT, classifyHttp, fetchPublicLink, reportAndVerify };
