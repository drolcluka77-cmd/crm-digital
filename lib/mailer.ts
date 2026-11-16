import nodemailer from "nodemailer";
import { getSettings } from "@/lib/settings";

export class MailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email sending isn't configured yet. Set BREVO_API_KEY on the server, or go to Admin > Settings and fill in the SMTP details."
    );
    this.name = "MailNotConfiguredError";
  }
}

export type MailAttachment = {
  filename: string;
  content: Uint8Array | Buffer;
  contentType?: string;
};

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
};

/**
 * Two ways to send:
 *
 * - Brevo HTTP API, when the BREVO_API_KEY environment variable is set.
 *   Needed on hosts that block outbound SMTP (Railway Free/Trial/Hobby).
 * - SMTP, from Admin > Settings (or SMTP_* environment variables).
 *
 * The "From" address is the same in both cases: Settings → "From" address
 * (or SMTP_FROM / the SMTP username). With Brevo, its domain must be
 * verified in Brevo (Senders, Domains & Dedicated IPs).
 */
async function getConfig() {
  const settings = await getSettings();
  const user = settings.smtpUser || process.env.SMTP_USER;
  const from = settings.smtpFrom || process.env.SMTP_FROM || user || "";
  return { settings, user, from };
}

/** Splits `Name <email@x>` or `email@x` into name + email. */
function parseAddress(value: string): { email: string; name?: string } {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1].trim() || undefined };
  return { email: value.trim() };
}

async function sendViaBrevo(apiKey: string, fromValue: string, senderName: string, msg: Message) {
  if (!fromValue) {
    throw new Error('Set the "From" address in Admin > Settings (e.g. info@yourdomain.com) before sending with Brevo.');
  }
  const from = parseAddress(fromValue);
  const body: Record<string, unknown> = {
    sender: { email: from.email, name: from.name || senderName },
    to: [parseAddress(msg.to)],
    subject: msg.subject,
    htmlContent: msg.html,
    textContent: msg.text,
  };
  if (msg.replyTo) body.replyTo = parseAddress(msg.replyTo);
  if (msg.attachments && msg.attachments.length > 0) {
    body.attachment = msg.attachments.map((a) => ({
      name: a.filename,
      content: Buffer.from(a.content).toString("base64"),
    }));
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.message || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`Brevo couldn't send the email (${res.status}): ${detail}`);
  }
}

async function deliver(msg: Message) {
  const { settings, user, from } = await getConfig();

  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    await sendViaBrevo(brevoKey, from, settings.companyName || "Distribution Hub", msg);
    return;
  }

  const host = settings.smtpHost || process.env.SMTP_HOST;
  const port = settings.smtpPort || Number(process.env.SMTP_PORT || 0);
  const pass = settings.smtpPass || process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) {
    throw new MailNotConfiguredError();
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS, 587/25 = STARTTLS
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: from || user,
    to: msg.to,
    replyTo: msg.replyTo,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    attachments: (msg.attachments || []).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
      contentType: a.contentType,
    })),
  });
}

/** Which way emails go — shown on the Settings page. */
export function mailProvider(): "brevo" | "smtp" {
  return process.env.BREVO_API_KEY ? "brevo" : "smtp";
}

export async function sendQuoteEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: { filename: string; content: Uint8Array };
  replyTo?: string;
}) {
  await deliver({
    ...options,
    attachments: [{ ...options.attachment, contentType: "application/pdf" }],
  });
}

/** General-purpose send with optional attachments (used for materials). */
export async function sendEmail(options: Message) {
  await deliver(options);
}

/** Used by the Settings page's "send test email" button. */
export async function sendTestEmail(to: string) {
  await deliver({
    to,
    subject: "Sales CRM — test email",
    text: `If you're reading this, your CRM's email settings work (sent via ${mailProvider() === "brevo" ? "Brevo" : "SMTP"}).`,
    html: `<p>If you're reading this, your CRM's email settings work (sent via ${mailProvider() === "brevo" ? "Brevo" : "SMTP"}).</p>`,
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
  await deliver(options);
}
