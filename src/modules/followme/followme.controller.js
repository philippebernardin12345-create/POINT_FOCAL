const repository = require("./followme.repository");

async function getSponsorLinkForOpportunity(userId, position) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  if (!position || Number(position) < 1) {
    throw new Error("Position d’opportunité invalide.");
  }

  const user = await repository.findUserById(userId);

  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  const opportunity =
    await repository.findOpportunityByPosition(
      Number(position)
    );

  if (!opportunity) {
    throw new Error(
      "Aucune opportunité active trouvée à cette position."
    );
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

    if (
      sponsorOpportunity &&
      sponsorOpportunity.referral_link
    ) {
      sponsorLink =
        sponsorOpportunity.referral_link;
    }
  }

  if (!sponsorLink) {
    const rootUser =
      await repository.findRootUser();

    if (!rootUser) {
      throw new Error(
        "Aucun sponsor disponible et compte racine introuvable."
      );
    }

    const rootOpportunity =
      await repository.findUserOpportunity(
        rootUser.id,
        opportunity.id
      );

    if (
      rootOpportunity &&
      rootOpportunity.referral_link
    ) {
      sponsorLink =
        rootOpportunity.referral_link;

      sponsorUserId =
        rootUser.id;

      source =
        "root";
    } else if (opportunity.root_sponsor_link) {
      sponsorLink =
        opportunity.root_sponsor_link;

      sponsorUserId =
        rootUser.id;

      source =
        "root";
    }
  }

  if (!sponsorLink) {
    throw new Error(
      "Aucun lien de sponsor disponible pour cette opportunité."
    );
  }

  return {
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      slug: opportunity.slug,
      position: opportunity.position,
      type: opportunity.type
    },
    sponsorUserId,
    sponsorLink,
    source
  };
}

module.exports = {
  getSponsorLinkForOpportunity
};