import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const sendMail = async ({ to, subject, html, text, from }) => {
  const fromAddress = from || process.env.SENDGRID_FROM || process.env.MAIL_USER || process.env.MAIL_FROM;
  const msg = {
    to,
    from: fromAddress,
    subject,
    html,
    text,
  };
  const [response] = await sgMail.send(msg);
  return response;
};