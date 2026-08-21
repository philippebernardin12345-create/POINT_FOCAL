
const { Web3 } = require("web3");

let _web3 = null;
let _USDT_CONTRACT = null;
let _ERC20_TRANSFER_TOPIC = null;

function getBlockchain() {
  if (!_web3) {
    if (!process.env.BSC_RPC_URL) {
      throw new Error("BSC_RPC_URL manquant dans les variables d'environnement.");
    }

    if (!process.env.USDT_BEP20_CONTRACT) {
      throw new Error("USDT_BEP20_CONTRACT manquant dans les variables d'environnement.");
    }

    _web3 = new Web3(process.env.BSC_RPC_URL);
    _USDT_CONTRACT = process.env.USDT_BEP20_CONTRACT.toLowerCase();
    _ERC20_TRANSFER_TOPIC = _web3.utils.sha3("Transfer(address,address,uint256)");
  }

  return {
    web3: _web3,
    USDT_CONTRACT: _USDT_CONTRACT,
    ERC20_TRANSFER_TOPIC: _ERC20_TRANSFER_TOPIC
  };
}

module.exports = {
  get web3() { return getBlockchain().web3; },
  get USDT_CONTRACT() { return getBlockchain().USDT_CONTRACT; },
  get ERC20_TRANSFER_TOPIC() { return getBlockchain().ERC20_TRANSFER_TOPIC; }
};