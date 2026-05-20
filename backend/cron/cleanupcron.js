const { pool } = require('../database');

async function cleanup() {

    const client = await pool.connect();

    try {

        const result = await client.query(`
            DELETE FROM users
            WHERE account_status = 'pending'
            AND created_at < NOW() - INTERVAL '48 HOURS'
        `);

        console.log(
            `Deleted users: ${result.rowCount}`
        );

    } finally {
        client.release();
    }
}

cleanup();

setInterval(cleanup, 60 * 60 * 1000);
