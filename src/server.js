require("dotenv").config();

const app = require("./app");
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Point Focal Backend V10 running on port ${PORT}`);
});