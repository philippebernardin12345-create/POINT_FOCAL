function checkVictoryAutomaticEligibility(user, now = new Date()) {
  const linkActive =
    user &&
    (
      user.link_active === true ||
      user.link_active === 1 ||
      String(user.link_active).toLowerCase() === "true"
    );
  const invitationCode = String(user?.invitation_code ?? "").trim();

  if (!user || !user.victory_personal_link || !linkActive || !invitationCode) {
    return {
      eligible: false,
      reason: "Victory Automatic doit être complété et le lien Point Focal activé avant de poursuivre vers Victory World."
    };
  }

  const status = String(user.status || "").toLowerCase();
  const expirationDate = user.victory_expires_at
    ? new Date(user.victory_expires_at)
    : null;

  if (
    user.victory_expired === true ||
    status === "expired" ||
    (expirationDate && (
      !Number.isFinite(expirationDate.getTime()) ||
      expirationDate.getTime() <= now.getTime()
    ))
  ) {
    return {
      eligible: false,
      reason: "Votre délai de Victory Automatic a expiré. Demandez une réactivation."
    };
  }

  return { eligible: true, reason: null };
}

function assertVictoryAutomaticEligible(user, now = new Date()) {
  const result = checkVictoryAutomaticEligibility(user, now);
  if (!result.eligible) {
    throw new Error(result.reason);
  }
}

module.exports = {
  checkVictoryAutomaticEligibility,
  assertVictoryAutomaticEligible
};
