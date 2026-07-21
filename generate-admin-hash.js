const bcrypt = require("bcryptjs");

const password =
  process.env.ADMIN_TEMP_PASSWORD;

if (!password) {
  console.log(
    "ADMIN_TEMP_PASSWORD est absente."
  );

  process.exit(1);
}

bcrypt
  .hash(password, 12)
  .then((hash) => {

    console.log(
      "================================"
    );

    console.log(
      "ADMIN_PASSWORD_HASH :"
    );

    console.log(hash);

    console.log(
      "================================"
    );

  })
  .catch((error) => {

    console.error(
      "Erreur :",
      error.message
    );

    process.exit(1);

  });