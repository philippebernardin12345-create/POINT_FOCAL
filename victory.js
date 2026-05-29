const pool = require("../db");

function generateCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";

  let code = "";
  for (let i = 0; i < 4; i++)
    code += letters[Math.floor(Math.random() * letters.length)];

  for (let i = 0; i < 4; i++)
    code += numbers[Math.floor(Math.random() * numbers.length)];

  return code;
}

exports.generate = async (req, res) => {

  const userId = "auth-user";

  const code = generateCode();
  const url = `https://victoryautomatic.com/user/register/${code}`;

  await pool.query(
    "INSERT INTO victory_links(user_id, code, url) VALUES($1,$2,$3)",
    [userId, code, url]
  );

  res.end(JSON.stringify({ code, url }));
};