import nodemailer from "nodemailer";

/**
 * Sends an email using dynamic SMTP configuration.
 * If credentials or server configuration is missing, it logs details to the console as a dry run.
 * 
 * @param config SMTP configuration object containing host, port, user, password, secure, and fromEmail
 * @param to Recipient email address
 * @param subject Email subject
 * @param html Email HTML body content
 */
export async function sendMail(
  config: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
    fromEmail?: string;
  } | null | undefined,
  to: string,
  subject: string,
  html: string
) {
  if (!config || !config.host || !config.port || !config.user || !config.password) {
    console.log("==================================================");
    console.log("📩 [SMTP Mailer - UNCONFIGURED FALLBACK LOG]");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("Content:");
    console.log(html);
    console.log("==================================================");
    return { dryRun: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port),
      secure: config.secure || false,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    const info = await transporter.sendMail({
      from: config.fromEmail || `"SupportDesk" <noreply@localhost>`,
      to,
      subject,
      html,
    });

    console.log(`📩 [Mailer] Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ [Mailer] Error sending email via SMTP host ${config.host}:`, error);
    console.log("==================================================");
    console.log("📩 [SMTP Mailer - ERROR FALLBACK LOG]");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("Content:");
    console.log(html);
    console.log("==================================================");
    throw error;
  }
}
