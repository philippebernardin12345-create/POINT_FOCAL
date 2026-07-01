require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

// DEBUG
console.log("DATABASE_URL =", process.env.DATABASE_URL);

app.listen(PORT, () => {
  console.log(`Point Focal Backend V9 running on port ${PORT}`);
});