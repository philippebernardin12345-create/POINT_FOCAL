function checkVictoryAutomaticEligibility(user, now = new Date()) {
  const linkActive =
    user &&
    (
      user.link_active === true ||
      user.link_active === 1 ||
      String(user.link_active).toLowerCase() === "true"
    );
  const invitationCode = String(user?.invitation_code ?? "").trim();

  const worldStatus = String(user?.victory_world_status || "").toLowerCase();
  const alreadyAdmittedToVictoryWorld = Boolean(
    user?.victory_world_assigned_link ||
    user?.victory_world_link ||
    worldStatus === "validated"
  );

  if (
    !alreadyAdmittedToVictoryWorld &&
    (
      !user ||
      !user.victory_personal_link ||
      !linkActive ||
      !invitationCode
    )
  ) {
    return {
      eligible: false,
      reason: "Terminez et faites valider Victory Automatic avant de poursuivre vers Victory World."
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
