const Web3 = require("web3");

const web3 = new Web3(process.env.BSC_RPC_URL);

const USDT_CONTRACT = process.env.USDT_BEP20_CONTRACT;

module.exports = {
  web3,
  USDT_CONTRACT
};