
const { Web3 } = require("web3");

if (!process.env.BSC_RPC_URL) {
  throw new Error("BSC_RPC_URL manquant dans les variables d'environnement.");
}

if (!process.env.USDT_BEP20_CONTRACT) {
  throw new Error("USDT_BEP20_CONTRACT manquant dans les variables d'environnement.");
}

const web3 = new Web3(process.env.BSC_RPC_URL);

const USDT_CONTRACT = process.env.USDT_BEP20_CONTRACT.toLowerCase();

const ERC20_TRANSFER_TOPIC = web3.utils.sha3("Transfer(address,address,uint256)");

module.exports = {
  web3,
  USDT_CONTRACT,
  ERC20_TRANSFER_TOPIC
};