const repository = require("./followme.repository");

function generateLetters(length) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += letters[
      Math.floor(Math.random() * letters.length)
    ];
  }

  return result;
}

function generateSeries2Code() {
  const numbers = Math.floor(
    1000 + Math.random() * 9000
  ).toString();

  return `${numbers}${generateLetters(4)}`;
}

function generateSeries3Code() {
  const firstNumbers = Math.floor(
    10 + Math.random() * 90
  ).toString();

  const secondNumbers = Math.floor(
    10 + Math.random() * 90
  ).toString();

  return (
    firstNumbers +
    generateLetters(2) +
    secondNumbers +
    generateLetters(2)
  );
}

async function getSponsorLinkForOpportunity(
  userId,
  position
) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const opportunityPosition =
    Number(position);

  if (
    !Number.isInteger(opportunityPosition) ||
    opportunityPosition < 1
  ) {
    throw new Error(
      "Position d’opportunité invalide."
    );
  }

  const user =
    await repository.findUserById(userId);

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  const opportunity =
    await repository.findOpportunityByPosition(
      opportunityPosition
    );

  if (!opportunity) {
    throw new Error(
      "Aucune opportunité active trouvée."
    );
  }

  let sponsorLink = null;
  let sponsorUserId =
    user.sponsor_id || null;

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
        "Compte racine introuvable."
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

      source = "root";

    } else if (
      opportunity.root_sponsor_link
    ) {
      sponsorLink =
        opportunity.root_sponsor_link;

      sponsorUserId =
        rootUser.id;

      source = "root";
    }
  }

  if (!sponsorLink) {
    throw new Error(
      "Aucun lien disponible pour cette opportunité."
    );
  }

  return {
  opportunity: {
    id: opportunity.id,
    name: opportunity.name,
    slug: opportunity.slug,
    position: opportunity.position,
    type: opportunity.type,
    entryMode: opportunity.entry_mode
  },
  sponsorUserId,
  sponsorLink,
  source
};
}

async function savePersonalOpportunityLink(
  userId,
  position,
  referralLink
) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const opportunityPosition =
    Number(position);

  if (
    !Number.isInteger(opportunityPosition) ||
    opportunityPosition < 1
  ) {
    throw new Error(
      "Position d’opportunité invalide."
    );
  }

  const cleanReferralLink =
    String(referralLink || "").trim();

  if (!cleanReferralLink) {
    throw new Error(
      "Lien personnel obligatoire."
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(cleanReferralLink);
  } catch {
    throw new Error(
      "Format du lien personnel invalide."
    );
  }

  if (
    parsedUrl.protocol !== "https:" &&
    parsedUrl.protocol !== "http:"
  ) {
    throw new Error(
      "Le lien personnel doit commencer par http:// ou https://."
    );
  }

  const user =
    await repository.findUserById(userId);

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  const opportunity =
    await repository.findOpportunityByPosition(
      opportunityPosition
    );

  if (!opportunity) {
    throw new Error(
      "Opportunité introuvable."
    );
  }

  const previousCompleted =
    await repository.findPreviousOpportunityCompleted(
      userId,
      opportunity.position
    );

  if (!previousCompleted) {
    throw new Error(
      "Vous devez terminer l’opportunité précédente avant de continuer."
    );
  }

  let sponsorUserId =
    user.sponsor_id || null;

  if (!sponsorUserId) {
    const rootUser =
      await repository.findRootUser();

    sponsorUserId =
      rootUser ? rootUser.id : null;
  }

  const saved =
    await repository.saveUserOpportunityLink(
      userId,
      opportunity.id,
      sponsorUserId,
      cleanReferralLink
    );

  if (!saved) {
    throw new Error(
      "Impossible d’enregistrer le lien personnel."
    );
  }

  let generatedSeries2 = null;
  let generatedSeries3 = null;

  if (
    Number(opportunity.position) === 3 &&
    !user.invitation_code_series_2
  ) {
    generatedSeries2 =
      generateSeries2Code();

    await repository.saveSeries2Code(
      userId,
      generatedSeries2
    );
  }

  if (
    Number(opportunity.position) === 4 &&
    !user.invitation_code_series_3
  ) {
    generatedSeries3 =
      generateSeries3Code();

    await repository.saveSeries3Code(
      userId,
      generatedSeries3
    );
  }

  return {
    success: true,
    message:
      "Votre lien personnel a été enregistré avec succès.",
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      slug: opportunity.slug,
      position: opportunity.position
    },
    referralLink:
      saved.referral_link,
    generatedCodes: {
      series2: generatedSeries2,
      series3: generatedSeries3
    }
  };
}

module.exports = {
  getSponsorLinkForOpportunity,
  savePersonalOpportunityLink
};