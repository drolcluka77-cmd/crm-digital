import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/url";
import { escapeHtml, formatMoney, computeQuoteBreakdown } from "@/lib/format";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Daily digest — call once a morning from any scheduler:
 *   GET /api/cron/daily?secret=CRON_SECRET
 * Sellers get today's follow-ups, demos and upcoming renewals by email.
 * On Mondays (or with &weekly=1) managers/admins also get a team summary.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = getBaseUrl();
  const settings = await getSettings();
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const in14 = new Date(now.getTime() + 14 * 86_400_000);
  const weekly = req.nextUrl.searchParams.get("weekly") === "1" || now.getDay() === 1;

  const sellers = await prisma.user.findMany({ where: { role: "SALES", active: true } });
  let sent = 0;
  const errors: string[] = [];

  for (const s of sellers) {
    const [due, demos, renewals] = await Promise.all([
      prisma.customer.findMany({
        where: { ownerId: s.id, status: { in: [...OPEN_LEAD_STATUSES] }, nextFollowUpAt: { lte: endOfToday } },
        orderBy: { nextFollowUpAt: "asc" },
        take: 20,
      }),
      prisma.customer.findMany({
        where: { ownerId: s.id, demoAt: { gte: startOfToday, lte: endOfToday } },
        orderBy: { demoAt: "asc" },
      }),
      prisma.subscription.findMany({
        where: { userId: s.id, status: "ACTIVE", renewalDate: { lte: in14 } },
        include: { customer: { select: { name: true, company: true } } },
        orderBy: { renewalDate: "asc" },
      }),
    ]);

    // One in-app reminder per renewal per cycle.
    for (const r of renewals) {
      const link = `/crm/subscriptions#${r.id}`;
      const already = await prisma.notification.count({
        where: { userId: s.id, type: "RENEWAL_DUE", link, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      });
      if (!already) {
        await prisma.notification.create({
          data: {
            userId: s.id,
            type: "RENEWAL_DUE",
            title: `${r.customer.company || r.customer.name} renews on ${r.renewalDate.toLocaleDateString("en-GB")}`,
            body: `${formatMoney(r.monthlyValue)} / month — check in before the renewal.`,
            link,
          },
        });
      }
    }

    if (!s.emailNotifications || (due.length === 0 && demos.length === 0 && renewals.length === 0)) continue;

    const li = (text: string, href: string) =>
      `<li style="margin:0 0 6px 0;"><a href="${base}${href}" style="color:#4338ca;text-decoration:none;">${escapeHtml(text)}</a></li>`;
    const section = (title: string, items: string[]) =>
      items.length ? `<h3 style="font-size:14px;margin:18px 0 6px 0;">${title}</h3><ul style="padding-left:18px;margin:0;">${items.join("")}</ul>` : "";

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;">
      <p style="margin:0 0 4px 0;">Good morning ${escapeHtml(s.name.split(" ")[0])},</p>
      <p style="margin:0;color:#475569;">Here's your day.</p>
      ${section(`📅 Demos today (${demos.length})`, demos.map((c) => li(`${c.demoAt!.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — ${c.company || c.name}`, `/crm/customers/${c.id}`)))}
      ${section(`📞 Follow-ups due (${due.length})`, due.map((c) => li(`${c.company || c.name}${c.nextFollowUpAt! < startOfToday ? " (overdue)" : ""}`, `/crm/customers/${c.id}`)))}
      ${section(`🔁 Renewals in the next 14 days (${renewals.length})`, renewals.map((r) => li(`${r.customer.company || r.customer.name} — ${r.renewalDate.toLocaleDateString("en-GB")}`, "/crm/subscriptions")))}
      <p style="margin-top:22px;"><a href="${base}/crm" style="display:inline-block;background:#4f46e5;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;">Open my CRM</a></p>
      <p style="margin-top:18px;font-size:12px;color:#94a3b8;">${escapeHtml(settings.companyName)} · turn these emails off under Account.</p>
    </div>`;

    try {
      await sendEmail({
        to: s.email,
        subject: `Today: ${demos.length ? `${demos.length} demo${demos.length === 1 ? "" : "s"}, ` : ""}${due.length} follow-up${due.length === 1 ? "" : "s"}`,
        html,
        text: `Demos today: ${demos.length}\nFollow-ups due: ${due.length}\nRenewals in 14 days: ${renewals.length}\n${base}/crm`,
      });
      sent++;
    } catch (e: any) {
      errors.push(`${s.email}: ${e?.message || "send failed"}`);
    }
  }

  // Weekly team summary for managers and admins.
  let weeklySent = 0;
  if (weekly) {
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const leaders = await prisma.user.findMany({
      where: { role: { in: ["MANAGER", "ADMIN"] }, active: true, emailNotifications: true },
    });
    for (const m of leaders) {
      const team = await prisma.user.findMany({
        where: { role: "SALES", active: true, ...(m.role === "MANAGER" ? { managerId: m.id } : {}) },
        select: { id: true, name: true },
      });
      if (team.length === 0) continue;
      const ids = team.map((t) => t.id);
      const [won, sentQuotes, newLeads, overdue, pending] = await Promise.all([
        prisma.quote.findMany({
          where: { userId: { in: ids }, status: "ACCEPTED", decidedAt: { gte: weekAgo } },
          include: { items: true },
        }),
        prisma.quote.count({ where: { userId: { in: ids }, sentAt: { gte: weekAgo } } }),
        prisma.customer.count({ where: { ownerId: { in: ids }, createdAt: { gte: weekAgo } } }),
        prisma.customer.count({
          where: { ownerId: { in: ids }, status: { in: [...OPEN_LEAD_STATUSES] }, nextFollowUpAt: { lt: startOfToday } },
        }),
        prisma.quote.count({ where: { userId: { in: ids }, approvalStatus: "PENDING" } }),
      ]);
      const wonValue = won.reduce((sum, q) => sum + computeQuoteBreakdown(q.items, q.discount, q.vatRate).annualNet, 0);
      const perSeller = team
        .map((t) => ({
          name: t.name,
          value: won
            .filter((q) => q.userId === t.id)
            .reduce((sum, q) => sum + computeQuoteBreakdown(q.items, q.discount, q.vatRate).annualNet, 0),
        }))
        .sort((a, b) => b.value - a.value);

      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
        <p style="margin:0 0 12px 0;font-weight:bold;">Your team's week</p>
        <table style="border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:3px 16px 3px 0;color:#475569;">Won</td><td><strong>${won.length} deals · ${escapeHtml(formatMoney(wonValue))}</strong></td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#475569;">Quotes sent</td><td>${sentQuotes}</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#475569;">New leads</td><td>${newLeads}</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#475569;">Overdue follow-ups</td><td>${overdue}</td></tr>
          <tr><td style="padding:3px 16px 3px 0;color:#475569;">Waiting for your approval</td><td>${pending}</td></tr>
        </table>
        <p style="margin:16px 0 4px 0;font-weight:bold;">Won by seller</p>
        <ul style="padding-left:18px;margin:0;">${perSeller.map((p) => `<li>${escapeHtml(p.name)} — ${escapeHtml(formatMoney(p.value))}</li>`).join("")}</ul>
        <p style="margin-top:20px;"><a href="${base}/admin" style="display:inline-block;background:#4f46e5;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;">Open dashboard</a></p>
      </div>`;
      try {
        await sendEmail({ to: m.email, subject: `Team week: ${won.length} won, ${formatMoney(wonValue)}`, html, text: `Won ${won.length} (${formatMoney(wonValue)}), quotes sent ${sentQuotes}, new leads ${newLeads}, overdue ${overdue}, approvals ${pending}. ${base}/admin` });
        weeklySent++;
      } catch (e: any) {
        errors.push(`${m.email}: ${e?.message || "send failed"}`);
      }
    }
  }

  return NextResponse.json({ ok: true, sellerDigests: sent, weeklySummaries: weeklySent, errors });
}
