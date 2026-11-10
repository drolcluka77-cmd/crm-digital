import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/url";
import { escapeHtml } from "@/lib/format";

type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  /** App path, e.g. /crm/customers/abc */
  link?: string | null;
};

/**
 * Creates in-app notifications and (unless the person switched it off)
 * sends the same message by email. Email failures never break the action
 * that triggered the notification.
 */
export async function notify(
  userIds: (string | null | undefined)[],
  n: NotificationInput,
  opts: { email?: boolean; baseUrl?: string } = {}
) {
  const ids = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (ids.length === 0) return;

  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: n.type,
      title: n.title,
      body: n.body || null,
      link: n.link || null,
    })),
  });

  if (opts.email === false) return;
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, active: true, emailNotifications: true },
    select: { email: true, name: true },
  });
  if (users.length === 0) return;

  let base = opts.baseUrl;
  if (!base) {
    try {
      base = getBaseUrl();
    } catch {
      base = process.env.APP_URL || "";
    }
  }
  const url = n.link ? `${base}${n.link}` : base;

  for (const u of users) {
    try {
      await sendEmail({
        to: u.email,
        subject: n.title,
        text: `${n.body || ""}\n\n${url}`.trim(),
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
          <p style="margin:0 0 8px 0;font-weight:bold;">${escapeHtml(n.title)}</p>
          ${n.body ? `<p style="margin:0 0 16px 0;color:#475569;">${escapeHtml(n.body)}</p>` : ""}
          ${url ? `<a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;">Open in CRM</a>` : ""}
          <p style="margin-top:24px;font-size:12px;color:#94a3b8;">You can turn these emails off under Account.</p>
        </div>`,
      });
    } catch {
      // SMTP not configured or failed — the in-app notification still exists.
    }
  }
}

/** Who approves / oversees a seller: their manager, or all admins if they have none. */
export async function supervisorsOf(sellerId: string): Promise<string[]> {
  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { managerId: true } });
  if (seller?.managerId) {
    const m = await prisma.user.findUnique({ where: { id: seller.managerId } });
    if (m?.active) return [m.id];
  }
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return admins.map((a) => a.id);
}
