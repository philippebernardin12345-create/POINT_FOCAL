const repository = require("./followme.repository");

function generateLetters(length) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += letters[
      Math.floor(
        Math.random() * letters.length
      )
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

  const opportunity =
    await repository.findOpportunityByPosition(
      Number(position)
    );

  const user =
    await repository.findUserById(userId);

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

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
      "Aucun lien disponible."
    );
  }

  return {
    opportunity,
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
  const user =
    await repository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  const opportunity =
    await repository.findOpportunityByPosition(
      Number(position)
    );

  if (!opportunity) {
    throw new Error(
      "Opportunité introuvable."
    );
  }

  const saved =
    await repository.saveUserOpportunityLink(
      userId,
      opportunity.id,
      user.sponsor_id,
      referralLink
    );

  if (!saved) {
    throw new Error(
      "Impossible d'enregistrer le lien."
    );
  }

  if (
    opportunity.position === 3 &&
    !user.invitation_code_series_2
  ) {
    await repository.saveSeries2Code(
      userId,
      generateSeries2Code()
    );
  }

  if (
    opportunity.position === 4 &&
    !user.invitation_code_series_3
  ) {
    await repository.saveSeries3Code(
      userId,
      generateSeries3Code()
    );
  }

  return {
    success: true,
    opportunity: opportunity.name,
    referralLink
  };
}

module.exports = {
  getSponsorLinkForOpportunity,
  savePersonalOpportunityLink
};