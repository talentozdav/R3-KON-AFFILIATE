import nodemailer from 'nodemailer';

async function main() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    secure: true,
    port: 465,
    auth: {
      user: 'resend',
      pass: 're_xxxxxxxxx',
    },
  });

  const info = await transporter.sendMail({
    from: 'onboarding@resend.dev',
    to: 'delivered@resend.dev',
    subject: 'Hello World',
    html: '<strong>it works!</strong>',
  });

  console.log('Message sent: %s', info.messageId);
}

main().catch(console.error);
