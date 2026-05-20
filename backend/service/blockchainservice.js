const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(
    process.env.BSC_RPC
);

const USDT_CONTRACT = process.env.USDT_CONTRACT.toLowerCase();
const TARGET_WALLET = process.env.TARGET_WALLET.toLowerCase();

const REQUIRED_AMOUNT = '2.03';

async function verifyUSDTTransaction(txHash) {

    try {

        const receipt = await provider.getTransactionReceipt(txHash);

        if (!receipt || receipt.status !== 1) {
            return false;
        }

        const transferTopic = ethers.id(
            'Transfer(address,address,uint256)'
        );

        const usdtLogs = receipt.logs.filter(log =>
            log.address.toLowerCase() === USDT_CONTRACT &&
            log.topics[0] === transferTopic
        );

        if (!usdtLogs.length) {
            return false;
        }

        for (const log of usdtLogs) {

            const to = '0x' + log.topics[2].slice(26);

            const amount = ethers.formatUnits(log.data, 18);

            if (
                to.toLowerCase() === TARGET_WALLET &&
                Number(amount).toFixed(2) === REQUIRED_AMOUNT
            ) {
                return true;
            }
        }

        return false;

    } catch (error) {

        console.error(error);

        return false;
    }
}

module.exports = {
    verifyUSDTTransaction
};
