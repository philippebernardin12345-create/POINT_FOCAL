const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');
const { generateInvitationCode } = require('../services/invitationService');

async function register(req, res) {

    const {
        email,
        password,
        confirmPassword,
        sponsor_code
    } = req.body;

    if (!email || !password || !confirmPassword) {
        return res.status(400).json({
            error: 'Missing fields'
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({
            error: 'Passwords do not match'
        });
    }

    const client = await pool.connect();

    try {

        const existing = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length) {
            return res.status(400).json({
                error: 'Email already exists'
            });
        }

        let sponsorCode = sponsor_code || 'ABCD1000';

        const sponsor = await client.query(
            'SELECT id FROM users WHERE invitation_code = $1',
            [sponsorCode]
        );

        if (!sponsor.rows.length) {
            return res.status(400).json({
                error: 'Invalid sponsor'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const invitationCode = generateInvitationCode();

        const result = await client.query(`
            INSERT INTO users (
                email,
                password_hash,
                sponsor_code,
                invitation_code
            )
            VALUES ($1,$2,$3,$4)
            RETURNING id,email,invitation_code
        `, [
            email,
            passwordHash,
            sponsorCode,
            invitationCode
        ]);

        const user = result.rows[0];

        await client.query(`
            INSERT INTO genealogy (
                user_id,
                sponsor_id,
                mlm_link,
                verified
            )
            VALUES ($1,$2,$3,$4)
        `, [
            user.id,
            sponsor.rows[0].id,
            'PENDING',
            true
        ]);

        const token = jwt.sign({
            id: user.id,
            email: user.email
        }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.json({
            success: true,
            token,
            user
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Registration failed'
        });

    } finally {
        client.release();
    }
}

async function login(req, res) {

    const { email, password } = req.body;

    const client = await pool.connect();

    try {

        const result = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        const valid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!valid) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        const token = jwt.sign({
            id: user.id,
            email: user.email
        }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                invitation_code: user.invitation_code,
                sponsor_code: user.sponsor_code,
                account_status: user.account_status
            }
        });

    } finally {
        client.release();
    }
}

module.exports = {
    register,
    login
};
