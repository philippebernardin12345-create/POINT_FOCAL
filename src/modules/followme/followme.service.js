
const repository = require("./followme.repository");

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

  const opportunity = await repository.findOpportunityBySlug(opportunitySlug);
  if (!opportunity) {
    throw new Error("Aucune opportunité active trouvée.");
  }

  let sponsorLink = null;
  let sponsorUserId = user.sponsor_id || null;
  let source = "sponsor";

  // 1. Cherche le lien du sponsor direct
  if (sponsorUserId) {
    const sponsorOpportunity = await repository.findUserOpportunity(
      sponsorUserId,
      opportunity.id
    );

    if (sponsorOpportunity && sponsorOpportunity.referral_link) {
      sponsorLink = sponsorOpportunity.referral_link;
    }
  }

  // 2. Fallback : lien du compte racine
  if (!sponsorLink) {
    const rootUser = await repository.findRootUser();

    if (!rootUser) {
      throw new Error("Compte racine introuvable.");
    }

    const rootOpportunity = await repository.findUserOpportunity(
      rootUser.id,
      opportunity.id
    );

    if (rootOpportunity && rootOpportunity.referral_link) {
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
      position: opportunity.position,
      isEntry: opportunity.is_entry,
      generatesLink: opportunity.generates_link
    },
    sponsorUserId,
    sponsorLink,
    source
  };
}

module.exports = { getSponsorLinkForOpportunity };
 

 