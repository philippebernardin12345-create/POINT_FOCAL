const db = require("../config/db");
const repository = require("../modules/followme/followme.repository");
const usersRepository = require("../modules/users/users.repository");
const v106Runtime = require("../db/v106-runtime");
const { getOpportunityById, getOpportunityBySlug } = require("./opportunity.engine");
const rollupService = require("./rollup.service");
const { logger } = require("../utils/logger");
const { isValidUrl } = require("../utils/validators");

async function getSponsorLinkForOpportunity(userId, opportunitySlug) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  if (!opportunitySlug) {
    throw new Error("Slug d'opportunité obligatoire.");
  }

  const user = await repository.findUserById(userId);

  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  const opportunity = getOpportunityBySlug(opportunitySlug);

  if (!opportunity) {
    throw new Error("Aucune opportunité active trouvée.");
  }

  let sponsorLink = null;
  let sponsorUserId = user.sponsor_id || null;
  let source = "sponsor";

  if (sponsorUserId) {
    const sponsorOpportunity =
      await repository.findUserOpportunity(
        sponsorUserId,
        opportunity.id
      );

    if (sponsorOpportunity?.referral_link) {
      sponsorLink = sponsorOpportunity.referral_link;
    }
  }

  if (!sponsorLink) {
    const rootUser = await v106Runtime.resolveRootUser();

    if (!rootUser?.id) {
      throw new Error("Compte racine introuvable.");
    }

    const rootOpportunity =
      await repository.findUserOpportunity(
        rootUser.id,
        opportunity.id
      );

    if (rootOpportunity?.referral_link) {
      sponsorLink = rootOpportunity.referral_link;
      sponsorUserId = rootUser.id;
      source = "root";
    }
  }

  if (!sponsorLink) {
    throw new Error("Aucun lien disponible pour cette opportunité.");
  }

  return {
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      slug: opportunity.slug,
      priority: opportunity.priority,
      isEntry: opportunity.isEntry,
      generatesLink: opportunity.canGeneratePointFocalLink
    },
    sponsorUserId,
    sponsorLink,
    source
  };
}

async function registerUserLink({
  userId,
  opportunityId,
  referralLink,
  targetAddress = null,
  paymentHash = null,
  sponsorId = null,
  client: externalClient = null
}) {
  try {
    if (!userId) {
      throw new Error("Utilisateur non authentifié");
    }

    if (!opportunityId) {
      throw new Error("Opportunité non spécifiée");
    }

    if (!referralLink) {
      throw new Error("Lien de parrainage obligatoire");
    }

    const execute = externalClient
      ? async (callback) => callback(externalClient)
      : db.withTransaction;

    return execute(async (client) => {
      const user = await repository.findUserById(
        userId,
        { client }
      );

      if (!user) {
        throw new Error("Utilisateur introuvable");
      }

      const opportunity = await getOpportunityById(
        opportunityId
      );

      if (!opportunity) {
        throw new Error("Opportunité introuvable");
      }

      const isActive =
        opportunity.status === "active" ||
        opportunity.isActive === true;

      const isAvailable =
        opportunity.isAvailable !== false;

      if (!isActive || !isAvailable) {
        throw new Error("Opportunité non disponible");
      }

      if (opportunity.validationRules) {
        const isValid = await validateLink(
          referralLink,
          opportunity.validationRules
        );

        if (!isValid) {
          throw new Error(
            "Format de lien invalide pour cette opportunité"
          );
        }
      }

      const linkValidation =
        await validateLinkStructure(
          referralLink,
          opportunity
        );

      if (!linkValidation.valid) {
        throw new Error(
          linkValidation.message || "Lien invalide"
        );
      }

      const existing =
        await repository.findUserOpportunity(
          userId,
          opportunityId,
          { client }
        );

      const linkOwner =
        await repository.findUserByLink(
          referralLink,
          opportunityId,
          { client }
        );

      if (
        linkOwner &&
        String(linkOwner.user_id) !== String(userId)
      ) {
        throw new Error(
          "Ce lien est déjà utilisé par un autre compte"
        );
      }

      let extractedSponsorId = null;

      if (opportunity.requiresSponsorValidation !== false) {
        extractedSponsorId =
          await extractSponsorFromLink(
            referralLink
          );
      }

      if (
        opportunity.requiresSponsorInDb === true &&
        extractedSponsorId
      ) {
        const extractedSponsor =
          await repository.findUserById(
            extractedSponsorId,
            { client }
          );

        if (!extractedSponsor) {
          throw new Error(
            "Le sponsor associé à ce lien n'est pas enregistré dans Point Focal"
          );
        }
      }

      const requestedSponsorId =
        sponsorId ??
        extractedSponsorId ??
        user.sponsor_id ??
        null;

      const placement =
        await rollupService.applyRollup(
          userId,
          opportunityId,
          {
            client,
            requestedSponsorId,
            referralLink,
            targetAddress,
            paymentHash
          }
        );

      return {
        success: true,
        action: existing ? "updated" : "created",
        message: existing
          ? "Lien mis à jour avec succès"
          : "Lien enregistré avec succès",
        data: placement.data,
        sponsorUserId: placement.sponsorId,
        rollupApplied:
          placement.rollupApplied,
        rollupResult: placement
      };
    });
  } catch (error) {
    logger.error("[FollowMe] Erreur registerUserLink:", error);
    throw error;
  }
}

async function findUserLink(
  userId,
  opportunityId,
  options = {}
) {
  const link =
    await repository.findUserOpportunity(
      userId,
      opportunityId,
      options
    );

  if (link?.status !== "active") {
    return null;
  }

  return link;
}

async function getUserLinks(userId, options = {}) {
  return repository.getUserLinks(userId, options);
}

async function getAvailableLink(
  opportunityId,
  excludeUserId = null,
  options = {}
) {
  return repository.getAvailableLink(
    opportunityId,
    excludeUserId,
    options
  );
}

async function validateLinkStructure(link, opportunity) {
  if (!link || typeof link !== "string") {
    return { valid: false, message: "Lien invalide" };
  }

  if (!isValidUrl(link)) {
    return {
      valid: false,
      message: "Format d'URL invalide"
    };
  }

  try {
    const url = new URL(link);

    if (
      opportunity.allowedDomains &&
      opportunity.allowedDomains.length > 0
    ) {
      const isDomainAllowed =
        opportunity.allowedDomains.some(
          (domain) =>
            url.hostname === domain ||
            url.hostname.endsWith(`.${domain}`)
        );

      if (!isDomainAllowed) {
        return {
          valid: false,
          message:
            `Domaine non autorisé. Domaines acceptés : ${opportunity.allowedDomains.join(", ")}`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: "URL mal formée"
    };
  }
}

async function extractSponsorFromLink(link) {
  try {
    const url = new URL(link);
    const params = new URLSearchParams(url.search);
    const code =
      params.get("ref") ||
      params.get("code") ||
      params.get("invitation");

    if (code) {
      const user =
        await usersRepository.findUserByInvitationCode(code);

      if (user) {
        return user.id;
      }
    }

    const pathParts = url.pathname.split("/").filter(Boolean);

    for (const part of pathParts) {
      const user =
        await usersRepository.findUserByInvitationCode(part);

      if (user) {
        return user.id;
      }
    }

    return null;
  } catch (error) {
    logger.warn(
      "[FollowMe] Impossible d'extraire le sponsor depuis le lien",
      error
    );
    return null;
  }
}

async function validateLink(link, rules) {
  if (!rules) {
    return true;
  }

  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);

    if (!regex.test(link)) {
      return false;
    }
  }

  if (rules.domain) {
    try {
      const url = new URL(link);
      const domain = url.hostname;

      if (
        domain !== rules.domain &&
        !domain.endsWith(`.${rules.domain}`)
      ) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  return true;
}

async function countActiveLinks(
  opportunityId,
  options = {}
) {
  return repository.countActiveLinks(
    opportunityId,
    options
  );
}

module.exports = {
  countActiveLinks,
  extractSponsorFromLink,
  findUserLink,
  getAvailableLink,
  getSponsorLinkForOpportunity,
  getUserLinks,
  registerUserLink,
  validateLink,
  validateLinkStructure
};
