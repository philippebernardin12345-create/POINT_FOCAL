const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.log(
    "Ajoute ton mot de passe après la commande."
  );

  process.exit(1);
}

bcrypt
  .hash(password, 12)
  .then((hash) => {
    console.log(hash);
  })
  .catch((error) => {
    console.error(error.message);
  });