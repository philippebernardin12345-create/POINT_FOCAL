const bcrypt = require("bcryptjs");
const authRepository = require("./auth.repository");
const { signToken } = require("../../config/jwt");
const { sendEmail } = require("../../config/email");

const ROOT_INVITATION_CODE = "ABCD1000";

function generateSeries1Code() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let partLetters = "";

  for (let i = 0; i < 4; i++) {
    partLetters += letters[Math.floor(Math.random() * letters.length)];
  }

  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `${partLetters}${numbers}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  const usedSponsorCode = invitationCode || sponsorCode;

  if (!email || !whatsapp || !password || !confirmPassword || !usedSponsorCode) {
    throw new Error("Tous les champs obligatoires doivent être renseignés.");
  }

  if (password !== confirmPassword) {
    throw new Error("Les mots de passe ne correspondent pas.");
  }

  const existingUser = await authRepository.findUserByEmail(email);
  if (existingUser) {
    throw new Error("Cet email est déjà utilisé.");
  }

  let sponsor = await authRepository.findUserByInvitationCode(usedSponsorCode);

  if (!sponsor && usedSponsorCode === ROOT_INVITATION_CODE) {
    sponsor = { id: null, is_root: true };
  }

  if (!sponsor) {
    throw new Error("Code d'invitation invalide.");
  }

  const campaign = await authRepository.getActiveCampaign();
  if (!campaign) {
    throw new Error("Aucune campagne active disponible.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let invitationCodeSeries1;
  let exists = true;

  while (exists) {
    invitationCodeSeries1 = generateSeries1Code();
    const userWithCode = await authRepository.findUserByInvitationCode(invitationCodeSeries1);
    exists = !!userWithCode;
  }

  const user = await authRepository.createUser({
    email,
    whatsapp,
    passwordHash,
    language,
    status: "pending",
    sponsorId: sponsor.id,
    campaignId: campaign.id,
    invitationCodeSeries1
  });

  const otp = generateOtp();
  const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await authRepository.saveEmailOtp(user.id, otp, otpExpiresAt);

  await sendEmail({
    to: user.email,
    subject: "Code de confirmation Point Focal",
    html: `
      <h2>Bienvenue sur Point Focal</h2>
      <p>Votre code de confirmation est :</p>
      <h1 style="letter-spacing:4px;">${otp}</h1>
      <p>Ce code expire dans 15 minutes.</p>
      <p>Retournez sur Point Focal et saisissez ce code pour activer votre compte.</p>
    `
  });

  return {
    user,
    message: "Inscription réussie. Un code OTP a été envoyé à votre email."
  };
}

async function login(payload) {
  const { email, password } = payload;

  if (!email || !password) {
    throw new Error("Email et mot de passe obligatoires.");
  }

  const user = await authRepository.findUserByEmail(email);
  if (!user) {
    throw new Error("Identifiants invalides.");
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new Error("Identifiants invalides.");
  }

  if (!user.email_confirmed) {
    throw new Error("Veuillez confirmer votre email avec le code OTP avant de vous connecter.");
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
      campaignId: user.campaign_id,
      invitationCodeSeries1: user.invitation_code_series_1,
      invitationCodeSeries2: user.invitation_code_series_2,
      isRoot: user.is_root,
      isLeader: user.is_leader,
      linkActive: user.link_active
    }
  };
}

async function confirmEmail(userId) {
  if (!userId) {
    throw new Error("Identifiant utilisateur manquant.");
  }

  const user = await authRepository.confirmEmail(userId);
  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  return user;
}

async function confirmOtp(payload) {
  const { email, otp } = payload;

  if (!email || !otp) {
    throw new Error("Email et code OTP obligatoires.");
  }

  const user = await authRepository.confirmEmailByOtp(email.trim(), otp.trim());

  if (!user) {
    throw new Error("Code OTP invalide ou expiré.");
  }

  return user;
}

async function me(userId) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  return {
    id: user.id,
    email: user.email,
    whatsapp: user.whatsapp,
    language: user.language,
    status: user.status,
    campaignId: user.campaign_id,
    invitationCodeSeries1: user.invitation_code_series_1,
    invitationCodeSeries2: user.invitation_code_series_2,
    isRoot: user.is_root,
    isLeader: user.is_leader,
    linkActive: user.link_active,
    emailConfirmed: user.email_confirmed
  };
}

module.exports = {
  register,
  login,
  confirmEmail,
  confirmOtp,
  me
};