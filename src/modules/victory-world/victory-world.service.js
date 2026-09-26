const repository =
  require("./victory-world.repository");

/* Validation du lien Victory World */

function validateVictoryWorldLink(link) {
  let parsedUrl;

  try {
    parsedUrl =
      new URL(
        String(link || "").trim()
      );
  } catch {
    throw new Error(
      "Format du lien Victory World invalide."
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname.toLowerCase() !==
      "victoryworld.club"
  ) {
    throw new Error(
      "Le lien doit commencer par https://victoryworld.club/."
    );
  }

  const pathParts =
    parsedUrl.pathname
      .split("/")
      .filter(Boolean);

  if (pathParts.length !== 1) {
    throw new Error(
      "Le lien Victory World doit respecter le format https://victoryworld.club/identifiant."
    );
  }

  const identifier =
    decodeURIComponent(
      pathParts[0]
    ).trim();

  if (
    !identifier ||
    !/^[a-zA-Z0-9._-]+$/.test(
      identifier
    )
  ) {
    throw new Error(
      "Identifiant Victory World invalide."
    );
  }

  return {
    identifier,

    normalizedLink:
      `https://victoryworld.club/${identifier}`
  };
}

/*
============================================================
ATTRIBUTION DU PARRAIN VICTORY WORLD
============================================================
*/

async function ensureAssignedSponsor(
  user
) {
  /*
   * 1. Une attribution déjà enregistrée est immuable.
   */
  if (
    user.victory_world_assigned_link
  ) {
    const existingSponsor =
      await repository
        .findUserByVictoryWorldLink(
          user.victory_world_assigned_link
        );

    if (!existingSponsor) {
      throw new Error(
        "Le parrain Victory World attribué n’existe plus dans Point Focal."
      );
    }

    return {
      assignedLink:
        user.victory_world_assigned_link,

      sponsor:
        existingSponsor,

      source:
        "existing"
    };
  }

  /*
   * 2. FOLLOW ME :
   * chercher d'abord le parrain structurel Point Focal.
   */
  const structuralSponsor =
    await repository
      .findVictoryWorldStructuralSponsor(
        user.sponsor_id
      );

  if (
    structuralSponsor &&
    structuralSponsor.status &&
    String(
      structuralSponsor.status
    ).toLowerCase() === "active" &&
    structuralSponsor.victory_world_status ===
      "validated" &&
    structuralSponsor.victory_world_link
  ) {
    const savedAssignment =
      await repository
        .saveAssignedVictoryWorldLink(
          user.id,
          structuralSponsor.victory_world_link
        );

    if (!savedAssignment) {
      throw new Error(
        "Impossible d’attribuer le parrain Victory World."
      );
    }

    return {
      assignedLink:
        savedAssignment
          .victory_world_assigned_link,

      sponsor:
        structuralSponsor,

      source:
        "follow_me"
    };
  }

  /*
   * 3. ROLL-UP :
   * le parrain structurel n'est pas disponible
   * dans Victory World -> lien racine Victory World.
   */
  const rootLink =
    await repository
      .findVictoryWorldRootLink();

  if (
    !rootLink ||
    !rootLink.victory_world_link
  ) {
    throw new Error(
      "Aucun lien racine Victory World disponible pour le Roll-up."
    );
  }

  const rootSponsor =
    await repository
      .findUserByVictoryWorldLink(
        rootLink.victory_world_link
      );

  if (!rootSponsor) {
    throw new Error(
      "Le lien racine Victory World n’appartient à aucun compte Point Focal."
    );
  }

  const savedAssignment =
    await repository
      .saveAssignedVictoryWorldLink(
        user.id,
        rootLink.victory_world_link
      );

  if (!savedAssignment) {
    throw new Error(
      "Impossible d’enregistrer le Roll-up Victory World."
    );
  }

  return {
    assignedLink:
      savedAssignment
        .victory_world_assigned_link,

    sponsor:
      rootSponsor,

    source:
      "rollup"
  };
}

/*
============================================================
ATTRIBUTION EXPLICITE DU PARRAIN
============================================================
*/

async function assignSponsor(userId) {
  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  const assignment =
    await ensureAssignedSponsor(
      user
    );

  return {
    success: true,
    assignedLink:
      assignment.assignedLink,
    sponsorUserId:
      assignment.sponsor.id
  };
}

/*
============================================================
ENREGISTRER LE LIEN PERSONNEL
============================================================
*/

async function saveLink(
  userId,
  payload = {}
) {
  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  if (
    user.victory_world_status ===
    "validated"
  ) {
    throw new Error(
      "Victory World est déjà validé pour ce compte."
    );
  }

  const {
    normalizedLink
  } = validateVictoryWorldLink(
    payload.victoryWorldLink
  );

  const assignment =
    await ensureAssignedSponsor(
      user
    );

  const registeredSponsor =
    await repository
      .findUserByVictoryWorldLink(
        assignment.assignedLink
      );

  if (!registeredSponsor) {
    throw new Error(
      "Le lien du parrain Victory World n’appartient à aucun membre enregistré dans Point Focal."
    );
  }

  if (
    normalizedLink ===
    assignment.assignedLink
  ) {
    throw new Error(
      "Votre lien personnel Victory World doit être différent du lien de votre parrain."
    );
  }

  const existingOwner =
    await repository
      .findUserByVictoryWorldLink(
        normalizedLink
      );

  if (
    existingOwner &&
    String(existingOwner.id) !==
      String(userId)
  ) {
    throw new Error(
      "Ce lien Victory World est déjà utilisé par un autre compte Point Focal."
    );
  }

  const saved =
    await repository
      .saveVictoryWorldLink(
        userId,
        normalizedLink
      );

  if (!saved) {
    throw new Error(
      "Impossible d’enregistrer votre lien Victory World."
    );
  }

    const nextOpportunity =
      await repository
        .findNextOpportunity(2);

  return {
    success: true,

    message:
      "Lien Victory World enregistré. L’opportunité suivante est maintenant accessible.",

    victoryWorldLink:
      saved.victory_world_link,

    assignedLink:
      assignment.assignedLink,

    sponsorUserId:
      registeredSponsor.id,

    status:
      saved.victory_world_status,

    startedAt:
      saved.victory_world_started_at,

      nextOpportunityUnlocked:
        Boolean(nextOpportunity),

      nextOpportunity
  };
}

/*
============================================================
STATUT
============================================================
*/

async function getStatus(userId) {
  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  const assignedLink =
    user.victory_world_assigned_link;

  if (assignedLink) {
    const sponsor =
      await repository
        .findUserByVictoryWorldLink(
          assignedLink
        );

    if (!sponsor) {
      throw new Error(
        "Le lien du parrain Victory World attribué n’existe plus dans la base."
      );
    }
  }

    const nextOpportunity =
      user.victory_world_status === "validated"
        ? await repository.findNextOpportunity(2)
        : null;

  return {
    success: true,

    assignedLink,

    victoryWorldLink:
      user.victory_world_link,

    targetAddress:
      user
        .victory_world_target_address,

    status:
      user.victory_world_status ||
      "not_started",

    txHash:
      user.victory_world_tx_hash,

    paidAt:
      user.victory_world_paid_at,

    startedAt:
      user.victory_world_started_at,

      nextOpportunityUnlocked:
        Boolean(nextOpportunity),

      nextOpportunity
  };
}

module.exports = {
  assignSponsor,
  saveLink,
  getStatus
};