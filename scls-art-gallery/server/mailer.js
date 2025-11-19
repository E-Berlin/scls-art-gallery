// server/mailer.js
const nodemailer = require("nodemailer");
const dotenv = require('dotenv')

dotenv.config()

const user = process.env.MAILER_USER
const pass = process.env.MAILER_PASS

async function sendVerificationEmail(toEmail, verifyLink) {
  // 这里用 Gmail 示例，你可以换成自己 SMTP
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 587,
    secure: false,
    auth: {
      user: `${user}`,  // 你的 Zoho 邮箱
      pass: `${pass}`,        // 应用专用密码
    },
  });

  const mailOptions = {
    from: '"SCLS Art Gallery" <club@bitebyte.tech>',
    to: toEmail,
    subject: "Email Verification",
    html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #fff; color: #000; text-align: center; padding: 40px;">
            <h2 style="color: #4caf50;">Welcome to register SCLS Art Gallery!</h2>
            <p>Please click the button below to complete your email verification:</p>
            <a href="${verifyLink}" 
               style="display:inline-block; padding:12px 24px; background-color:#4caf50; color:#fff; border-radius:8px; text-decoration:none; font-weight:bold;">
               Verify Email
            </a>
            <p style="margin-top:20px; color:#888;">If you did not register, please ignore this email.</p>
          </body>
        </html>
        `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
