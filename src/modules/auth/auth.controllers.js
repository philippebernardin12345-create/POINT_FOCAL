const authService = require("./auth.service");
const response = require("../../core/response");

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    return response.success(res, result, result.message, 201);
  } catch (err) {
    console.error("========== REGISTER ERROR ==========");
    console.error(err);
    return response.error(res, err.message || String(err), 400);
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return response.success(res, result, "Connexion réussie", 200);
  } catch (err) {
    console.error("========== LOGIN ERROR ==========");
    console.error(err);
    return response.error(res, err.message || String(err), 401);
  }
}

async function confirmEmail(req, res) {
  try {
    const result = await authService.confirmEmail(req.params.userId);
    return response.success(res, result, "Email confirmé avec succès", 200);
  } catch (err) {
    console.error("========== CONFIRM EMAIL ERROR ==========");
    console.error(err);
    return response.error(res, err.message || String(err), 400);
  }
}

async function confirmOtp(req, res) {
  try {
    const result = await authService.confirmOtp(req.body);
    return response.success(res, result, "Email confirmé avec succès", 200);
  } catch (err) {
    console.error("========== CONFIRM OTP ERROR ==========");
    console.error(err);
    return response.error(res, err.message || String(err), 400);
  }
}

async function me(req, res) {
  try {
    const result = await authService.me(req.user.id);
    return response.success(res, result, "Utilisateur connecté", 200);
  } catch (err) {
    console.error("========== ME ERROR ==========");
    console.error(err);
    return response.error(res, err.message || String(err), 401);
  }
}
async function forgotPassword(req, res) {
  try {
    const result = await authService.forgotPassword(req.body.email);

    return response.success(
      res,
      result,
      "Email de réinitialisation envoyé",
      200
    );
  } catch (err) {
    console.error("========== FORGOT PASSWORD ERROR ==========");
    console.error(err);

    return response.error(
      res,
      err.message || String(err),
      400
    );
  }
}

async function resetPassword(req, res) {
  try {
    const result = await authService.resetPassword(req.body);

    return response.success(
      res,
      result,
      "Mot de passe réinitialisé",
      200
    );
  } catch (err) {
    console.error("========== RESET PASSWORD ERROR ==========");
    console.error(err);

    return response.error(
      res,
      err.message || String(err),
      400
    );
  }
}
module.exports = {
  register,
  login,
  confirmEmail,
  confirmOtp,
  forgotPassword,
  resetPassword,
  me
};
