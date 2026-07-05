async function sendEmail({ to, subject, html }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: {
        email: process.env.SMTP_FROM,
        name: "Point Focal"
      },
      to: [
        {
          email: to
        }
      ],
      subject,
      htmlContent: html
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("BREVO API ERROR:", data);
    throw new Error(data.message || "Erreur envoi email Brevo API");
  }

  return data;
}

module.exports = {
  sendEmail
};