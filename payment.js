const pool = require("../db");
const config = require("../config");

exports.verify = async (req, res) => {

  const { txHash } = JSON.parse(req.body || "{}");

  // MOCK validation (à remplacer RPC BSC réel)
  const amount = 2.03;

  if (amount < config.PAYMENT_AMOUNT) {
    return res.end(JSON.stringify({ error: "insufficient" }));
  }

  await pool.query(
    "INSERT INTO payments(tx_hash, amount, status) VALUES($1,$2,'confirmed')",
    [txHash, amount]
  );

  res.end(JSON.stringify({ ok: true }));
};