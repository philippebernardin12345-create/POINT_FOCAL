require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret:
    process.env.JWT_SECRET || "CHANGE_ME_SECRET",

  jwtExpiresIn:
    process.env.JWT_EXPIRES_IN || "7d",

  bscRpcUrl:
    process.env.BSC_RPC_URL,

  usdtBep20Contract:
    process.env.USDT_BEP20_CONTRACT
};