const authService = require("./auth.service");
const response = require("../../core/response");

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    return response.success(res, result, result.message, 201);
  } catch (err) {
    return response.error(res, err.message, 400);
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return response.success(res, result, "Connexion réussie", 200);
  } catch (err) {
    return response.error(res, err.message, 401);
  }
}

async function confirmEmail(req, res) {
  try {
    const result = await authService.confirmEmail(req.params.userId);
    return response.success(res, result, "Email confirmé avec succès", 200);
  } catch (err) {
    return response.error(res, err.message, 400);
  }
}

// Utilisateur connecté
async function me(req, res) {
  try {
    return response.success(res, req.user, "Utilisateur connecté", 200);
  } catch (err) {
    return response.error(res, err.message, 401);
  }
}

module.exports = {
  register,
  login,
  confirmEmail,
  me
};