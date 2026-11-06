import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
host: process.env.RESEND_SMTP_HOST || "smtp.resend.com",
port: 465,
secure: true,
auth: {
user: "resend",
pass: process.env.RESEND_API_KEY,
},
});

export async function sendEmail({
to,
subject,
html,
}: {
to: string;
subject: string;
html: string;
}) {
return transporter.sendMail({
from: process.env.RESEND_FROM_EMAIL!,
to,
subject,
html,
});
}
