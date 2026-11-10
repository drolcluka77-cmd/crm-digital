import nodemailer from "nodemailer";
import { getSettings } from "@/lib/settings";

export class MailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email sending isn't configured yet. Go to Admin > Settings and fill in the SMTP details (e.g. a Gmail address + app password)."
    );
    this.name = "MailNotConfiguredError";
  }
}

/**
 * Builds a nodemailer transporter from the SMTP settings stored in the
 * database (Admin > Settings). Falls back to environment variables if
 * the settings row hasn't been filled in yet, so a Replit deployment
 * with SMTP_* secrets set works out of the box too.
 */
async function getTransport() {
  const settings = await getSettings();

  const host = settings.smtpHost || process.env.SMTP_HOST;
  const port = settings.smtpPort || Number(process.env.SMTP_PORT || 0);
  const user = settings.smtpUser || process.env.SMTP_USER;
  const pass = settings.smtpPass || process.env.SMTP_PASS;
  const from = settings.smtpFrom || process.env.SMTP_FROM || user;

  if (!host || !port || !user || !pass) {
    throw new MailNotConfiguredError();
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS, 587/25 = STARTTLS
    auth: { user, pass },
  });

  return { transporter, from: from as string };
}

export type MailAttachment = {
  filename: string;
  content: Uint8Array | Buffer;
  contentType?: string;
};

export async function sendQuoteEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: { filename: string; content: Uint8Array };
  replyTo?: string;
}) {
  await sendEmail({
    ...options,
    attachments: [{ ...options.attachment, contentType: "application/pdf" }],
  });
}

/** General-purpose send with optional attachments (used for materials). */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}) {
  const { transporter, from } = await getTransport();
  await transporter.sendMail({
    from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: (options.attachments || []).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
      contentType: a.contentType,
    })),
  });
}

/** Used by the Settings page's "send test email" button. */
export async function sendTestEmail(to: string) {
  const { transporter, from } = await getTransport();
  await transporter.sendMail({
    from,
    to,
    subject: "Sales CRM — test email",
    text: "If you're reading this, your CRM's email settings work.",
    html: "<p>If you're reading this, your CRM's email settings work.</p>",
  });
}

/** A plain email with no attachment — used for the customer "intro" emails. */
export async function sendPlainEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const { transporter, from } = await getTransport();
  await transporter.sendMail({
    from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}
