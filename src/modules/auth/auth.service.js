const bcrypt = require("bcryptjs");
const authRepository = require("./auth.repository");
const { signToken } = require("../../config/jwt");
const { sendEmail } = require("../../config/email");

const ROOT_INVITATION_CODE = "ABCD1000";

function generateOtp() {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}

async function register(payload) {
  const {
    email,
    whatsapp,
    password,
    confirmPassword,
    invitationCode,
    sponsorCode,
    language = "fr"
  } = payload;

  const normalizedEmail =
    String(email || "").trim().toLowerCase();

  const providedSponsorCode =
    String(
      invitationCode ||
      sponsorCode ||
      ""
    )
      .trim()
      .toUpperCase();

  /*
    Le code d’invitation n’est plus obligatoire.

    - Code présent : parrain réel.
    - Code absent : attribution FIFO.
    - Aucun candidat FIFO : racine.
  */
  if (
    !normalizedEmail ||
    !whatsapp ||
    !password ||
    !confirmPassword
  ) {
    throw new Error(
      "Tous les champs obligatoires doivent être renseignés."
    );
  }

  if (password !== confirmPassword) {
    throw new Error(
      "Les mots de passe ne correspondent pas."
    );
  }

  const existingUser =
    await authRepository.findUserByEmail(
      normalizedEmail
    );

  if (existingUser) {
    throw new Error(
      "Cet email est déjà utilisé."
    );
  }

  let sponsor = null;
  let sponsorAssignment = "personal";

  /*
    CAS 1 :
    L’utilisateur possède déjà le code
    d’invitation de son parrain.
  */
  if (providedSponsorCode) {
    sponsor =
      await authRepository.findUserByInvitationCode(
        providedSponsorCode
      );

    /*
      Le code racine peut être accepté même si
      aucun compte racine correspondant n’est
      encore enregistré dans users.
    */
    if (
      !sponsor &&
      providedSponsorCode === ROOT_INVITATION_CODE
    ) {
      sponsor = {
        id: null,
        is_root: true
      };

      sponsorAssignment = "root";
    }

    if (!sponsor) {
      throw new Error(
        "Code d'invitation invalide."
      );
    }
  } else {
    /*
      CAS 2 :
      Aucun code d’invitation.

      Le FIFO recherche le plus ancien utilisateur
      actif ayant moins de deux filleuls au total.
    */
    sponsor =
      await authRepository
        .findOldestAvailableSponsorForFifo();

    if (sponsor) {
      sponsorAssignment = "fifo";
    } else {
      /*
        CAS 3 :
        Aucun parrain FIFO disponible.

        Le surplus est rattaché à la racine.
      */
      sponsor = {
        id: null,
        is_root: true
      };

      sponsorAssignment = "root";
    }
  }

  const campaign =
    await authRepository.getActiveCampaign();

  if (!campaign) {
    throw new Error(
      "Aucune campagne active disponible."
    );
  }

  const passwordHash =
    await bcrypt.hash(password, 10);

  const user =
    await authRepository.createUser({
      email: normalizedEmail,
      whatsapp,
      passwordHash,
      language,
      status: "pending",
      sponsorId: sponsor.id,
      campaignId: campaign.id
    });

  if (!user) {
    throw new Error(
      "Impossible de créer le compte utilisateur."
    );
  }

  const otp = generateOtp();

  const otpExpiresAt =
    new Date(
      Date.now() + 15 * 60 * 1000
    );

  await authRepository.saveEmailOtp(
    user.id,
    otp,
    otpExpiresAt
  );

  await sendEmail({
    to: user.email,
    subject:
      "Code de confirmation Point Focal",
    html: `
      <h2>Bienvenue sur Point Focal</h2>

      <p>Votre code de confirmation est :</p>

      <h1 style="letter-spacing:4px;">
        ${otp}
      </h1>

      <p>Ce code expire dans 15 minutes.</p>

      <p>
        Retournez sur Point Focal et saisissez
        ce code pour activer votre compte.
      </p>
    `
  });

  let assignmentMessage =
    "Votre parrain personnel a été enregistré.";

  if (sponsorAssignment === "fifo") {
    assignmentMessage =
      "Un parrain disponible vous a été attribué automatiquement.";
  }

  if (sponsorAssignment === "root") {
    assignmentMessage =
      "Votre compte a été rattaché à la racine Point Focal.";
  }

  return {
    user,
    sponsorAssignment,
    message:
      `Inscription réussie. ${assignmentMessage} ` +
      "Un code OTP a été envoyé à votre email."
  };
}

async function login(payload) {
  const normalizedEmail =
    String(payload.email || "")
      .trim()
      .toLowerCase();

  const password = payload.password;

  if (!normalizedEmail || !password) {
    throw new Error(
      "Email et mot de passe obligatoires."
    );
  }

  const user =
    await authRepository.findUserByEmail(
      normalizedEmail
    );

  if (!user) {
    throw new Error(
      "Identifiants invalides."
    );
  }

  const validPassword =
    await bcrypt.compare(
      password,
      user.password_hash
    );

  if (!validPassword) {
    throw new Error(
      "Identifiants invalides."
    );
  }

  if (!user.email_confirmed) {
    throw new Error(
      "Veuillez confirmer votre email avec le code OTP avant de vous connecter."
    );
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    campaignId: user.campaign_id,
    isRoot: user.is_root,
    isLeader: user.is_leader
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      whatsapp: user.whatsapp,
      language: user.language,
      status: user.status,
      campaignId:
        user.campaign_id,

      invitationCodeSeries1:
        user.invitation_code_series_1,

      invitationCodeSeries2:
        user.invitation_code_series_2,

      invitationCodeSeries3:
        user.invitation_code_series_3,

      isRoot:
        user.is_root,

      isLeader:
        user.is_leader,

      isPrelaunchLeader:
        user.is_prelaunch_leader,

      linkActive:
        user.link_active,

      victoryPersonalLink:
        user.victory_personal_link,

      victoryExpired:
        user.victory_expired
    }
  };
}

async function confirmEmail(userId) {
  if (!userId) {
    throw new Error(
      "Identifiant utilisateur manquant."
    );
  }

  const user =
    await authRepository.confirmEmail(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  return user;
}

async function confirmOtp(payload) {
  const normalizedEmail =
    String(payload.email || "")
      .trim()
      .toLowerCase();

  const otp =
    String(payload.otp || "").trim();

  if (!normalizedEmail || !otp) {
    throw new Error(
      "Email et code OTP obligatoires."
    );
  }

  const user =
    await authRepository.confirmEmailByOtp(
      normalizedEmail,
      otp
    );

  if (!user) {
    throw new Error(
      "Code OTP invalide ou expiré."
    );
  }

  return user;
}

async function me(userId) {
  if (!userId) {
    throw new Error(
      "Utilisateur non authentifié."
    );
  }

  const user =
    await authRepository.findUserById(
      userId
    );

  if (!user) {
    throw new Error(
      "Utilisateur introuvable."
    );
  }

  return {
    id: user.id,
    email: user.email,
    whatsapp: user.whatsapp,
    language: user.language,
    status: user.status,

    campaignId:
      user.campaign_id,

    sponsorId:
      user.sponsor_id,

    invitationCodeSeries1:
      user.invitation_code_series_1,

    invitationCodeSeries2:
      user.invitation_code_series_2,

    invitationCodeSeries3:
      user.invitation_code_series_3,

    isRoot:
      user.is_root,

    isLeader:
      user.is_leader,

    isPrelaunchLeader:
      user.is_prelaunch_leader,

    linkActive:
      user.link_active,

    emailConfirmed:
      user.email_confirmed,

    victoryPersonalLink:
      user.victory_personal_link,

    victoryExpired:
      user.victory_expired
  };
}

module.exports = {
  register,
  login,
  confirmEmail,
  confirmOtp,
  me
};