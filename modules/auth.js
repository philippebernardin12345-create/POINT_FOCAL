const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../db");

const SECRET = "POINT_FOCAL_SUPER_SECRET_CHANGE_ME"; // ⚠️ mettre en .env en prod

// =========================
// REGISTER
// =========================
exports.register = async (req, res) => {
  let body = "";

  req.on("data", chunk => body += chunk);
  req.on("end", async () => {

    const { email, password, parrain } = JSON.parse(body);

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users(email, password_hash, parrain_id, state)
       VALUES($1,$2,$3,1)
       RETURNING id`,
      [email, hash, parrain || null]
    );

    const userId = result.rows[0].id;

    const token = jwt.sign(
      { userId, email },
      SECRET,
      { expiresIn: "7d" }
    );

    res.end(JSON.stringify({
      success: true,
      token,
      userId
    }));
  });
};

// =========================
// LOGIN
// =========================
exports.login = async (req, res) => {
  let body = "";

  req.on("data", chunk => body += chunk);
  req.on("end", async () => {

    const { email, password } = JSON.parse(body);

    const result = await pool.query(
      `SELECT * FROM users WHERE email=$1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.end(JSON.stringify({ error: "User not found" }));
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.end(JSON.stringify({ error: "Invalid password" }));
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      SECRET,
      { expiresIn: "7d" }
    );

    res.end(JSON.stringify({
      success: true,
      token,
      userId: user.id
    }));
  });
};

// =========================
// VERIFY TOKEN MIDDLEWARE
// =========================
exports.verifyToken = (req) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];

  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
};