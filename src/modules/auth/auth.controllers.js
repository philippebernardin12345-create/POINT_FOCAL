const authService = require("./auth.service");
const response = require("../../core/response");

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    return response.success(res, result, result.message, 201);
  } catch (err) {
    console.error("========== REGISTER ERROR ==========");
    console.error(err);
    console.error("Message :", err.message);
    console.error("Stack :", err.stack);
    console.error("====================================");

    return response.error(
      res,
      err.message || String(err),
      400
    );
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return response.success(res, result, "Connexion réussie", 200);
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return response.error(
      res,
      err.message || String(err),
      401
    );
  }
}

async function confirmEmail(req, res) {
  try {
    const result = await authService.confirmEmail(req.params.userId);
    return response.success(res, result, "Email confirmé avec succès", 200);
  } catch (err) {
    console.error("CONFIRM EMAIL ERROR:", err);

    return response.error(
      res,
      err.message || String(err),
      400
    );
  }
}

async function me(req, res) {
  try {
    const result = await authService.me(req.user.id);
    return response.success(res, result, "Utilisateur connecté", 200);
  } catch (err) {
    console.error("ME ERROR:", err);

    return response.error(
      res,
      err.message || String(err),
      401
    );
  }
}

module.exports = {
  register,
  login,
  confirmEmail,
  me
};