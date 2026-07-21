const bcrypt = require("bcryptjs");

const password =
  process.argv[2];

if (!password) {
  console.log(
    "Utilisation : node generate-admin-hash.js TON_MOT_DE_PASSE"
  );

  process.exit(1);
}

bcrypt
  .hash(password, 12)
  .then((hash) => {

    console.log(
      "\nADMIN_PASSWORD_HASH=\n"
    );

    console.log(hash);

  })
  .catch((error) => {

    console.error(
      "Erreur :",
      error.message
    );

    process.exit(1);

  });