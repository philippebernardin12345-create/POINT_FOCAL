const { pool } = require('../database');
const { verifyUSDTTransaction } = require('../services/blockchainService');

async function verifyTransaction(req, res) {

    const { tx_hash } = req.body;

    const userId = req.user.id;

    const valid = await verifyUSDTTransaction(tx_hash);

    if (!valid) {
        return res.status(400).json({
            error: 'Invalid transaction'
        });
    }

    const client = await pool.connect();

    try {

        await client.query(`
            INSERT INTO transactions (
                user_id,
                tx_hash,
                amount,
                token,
                network,
                wallet_to,
                verified
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [
            userId,
            tx_hash,
            2.03,
            'USDT',
            'BSC',
            process.env.TARGET_WALLET,
            true
        ]);

        await client.query(`
            UPDATE users
            SET payment_verified = true
            WHERE id = $1
        `, [userId]);

        res.json({
            success: true,
            verified: true
        });

    } finally {
        client.release();
    }
}

module.exports = {
    verifyTransaction
};
