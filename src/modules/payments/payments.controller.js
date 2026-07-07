
const paymentsService = require("./payments.service");

async function autoTrigger(req, res) {
  try {
    const result = await paymentsService.autoTrigger(req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Paiement test validé",
      publicLink: result.publicLink
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "Erreur validation paiement test"
    });
  }
}

module.exports = {
  autoTrigger
};