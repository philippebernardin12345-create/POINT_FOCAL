const bcrypt = require("bcryptjs");
const authRepository = require("./auth.repository");
const { signToken } = require("../../config/jwt");

function generateSeries1Code() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let partLetters = "";

  for (let i = 0; i < 4; i++) {
    partLetters += letters[Math.floor(Math.random() * letters.length)];
  }

  const numbers = Math.floor(1000 + Math.random() * 9000);

  return `${partLetters}${numbers}`;
}

async function register(payload) {
  const {
    email,
    whatsapp,
    password,
    confirmPassword,
    invitationCode,
    language = "fr"
  } = payload;

  if (!email || !whatsapp || !password || !confirmPassword || !invitationCode) {
    throw new Error("Tous les champs obligatoires doivent être renseignés.");
  }

  if (password !== confirmPassword) {
    throw new Error("Les mots de passe ne correspondent pas.");
  }

  const existingUser = await authRepository.findUserByEmail(email);
  if (existingUser) {
    throw new Error("Cet email est déjà utilisé.");
  }

  const sponsor = await authRepository.findUserByInvitationCode(invitationCode);
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
    const userWithCode = await authRepository.findUserByInvitationCode(
      invitationCodeSeries1
    );
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

  return {
    user,
    message:
      "Inscription réussie. Veuillez confirmer votre email avant de vous connecter."
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
    throw new Error("Veuillez confirmer votre email avant de vous connecter.");
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

module.exports = {
  register,
  login,
  confirmEmail
};