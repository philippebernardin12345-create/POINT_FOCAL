async function me(req, res) {
  try {
    const result = await authService.me(req.user.id);
    return response.success(res, result, "Utilisateur connecté", 200);
  } catch (err) {
    return response.error(res, err.message, 401);
  }
}