import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSellerProducts } from "@/lib/seller";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import {
  PlusIcon,
  ChartIcon,
  SendIcon,
  CoinsIcon,
  CalendarIcon,
  EyeIcon,
  ClockIcon,
} from "@/components/icons";
import { computeQuoteBreakdown, followUpLabel, formatMoney, timeAgo } from "@/lib/format";
import { LEAD_STATUS_LABEL, OPEN_LEAD_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const QUIET_DAYS = 14;

export default async function CrmTodayPage() {
  const user = await requireSales();

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const quietBefore = new Date(Date.now() - QUIET_DAYS * 86_400_000);
  const openStatuses = [...OPEN_LEAD_STATUSES];

  const in7 = new Date(Date.now() + 7 * 86_400_000);
  const in30 = new Date(Date.now() + 30 * 86_400_000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [dueLeads, quietLeads, opened, quotes, products, customerCount, demos, renewals] = await Promise.all([
    prisma.customer.findMany({
      where: { ownerId: user.id, status: { in: openStatuses }, nextFollowUpAt: { lte: endOfToday } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 12,
    }),
    prisma.customer.findMany({
      where: {
        ownerId: user.id,
        status: { in: openStatuses },
        nextFollowUpAt: null,
        OR: [{ lastContactAt: null, createdAt: { lt: quietBefore } }, { lastContactAt: { lt: quietBefore } }],
      },
      orderBy: { lastContactAt: "asc" },
      take: 6,
    }),
    prisma.materialShare.findMany({
      where: { userId: user.id, views: { gt: 0 }, lastViewedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      include: { material: { select: { title: true } }, customer: { select: { id: true, name: true, company: true } } },
      orderBy: { lastViewedAt: "desc" },
      take: 6,
    }),
    prisma.quote.findMany({ where: { userId: user.id }, include: { items: true, customer: true } }),
    getSellerProducts(user),
    prisma.customer.count({ where: { ownerId: user.id } }),
    prisma.customer.findMany({
      where: { ownerId: user.id, demoAt: { gte: startOfToday, lte: in7 } },
      orderBy: { demoAt: "asc" },
      take: 6,
    }),
    prisma.subscription.findMany({
      where: { userId: user.id, status: "ACTIVE", renewalDate: { lte: in30 } },
      include: { customer: { select: { id: true, name: true, company: true } } },
      orderBy: { renewalDate: "asc" },
      take: 6,
    }),
  ]);
  const approvalIssues = quotes.filter((q) => q.approvalStatus === "PENDING" || q.approvalStatus === "REJECTED");

  const withValue = quotes.map((q) => ({ q, b: computeQuoteBreakdown(q.items, q.discount, q.vatRate) }));
  const open = withValue.filter(({ q }) => q.status === "DRAFT" || q.status === "SENT");
  const sent = withValue.filter(({ q }) => q.status === "SENT");
  const won = withValue.filter(({ q }) => q.status === "ACCEPTED");
  const wonMonth = won.filter(({ q }) => (q.decidedAt || q.updatedAt) >= startOfMonth);
  const total = (l: typeof withValue, k: "annualNet" | "commission") => l.reduce((s, x) => s + x.b[k], 0);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="section-title mb-1">Today · {today}</div>
          <h1 className="text-3xl font-semibold tracking-tight">Good to see you, {user.name.split(" ")[0]}.</h1>
          <p className="text-black/50 mt-1">
            {dueLeads.length
              ? `${dueLeads.length} follow-up${dueLeads.length === 1 ? "" : "s"} waiting for you today.`
              : "No follow-ups due — a good day to find new leads."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/crm/quick" className="btn-secondary lg:hidden">
            Log a call
          </Link>
          <Link href="/crm/customers" className="btn-secondary">
            <PlusIcon className="h-4 w-4" /> Lead
          </Link>
          <Link href="/crm/quotes/new" className="btn-primary">
            <PlusIcon className="h-4 w-4" /> Quote
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          tone="dark"
          label="Open pipeline"
          value={formatMoney(total(open, "annualNet"))}
          sublabel={`${open.length} quotes · ${customerCount} customers`}
          icon={<ChartIcon className="h-5 w-5" />}
        />
        <StatCard
          tone="accent"
          label="Won this month"
          value={formatMoney(total(wonMonth, "annualNet"))}
          sublabel={`${wonMonth.length} deal${wonMonth.length === 1 ? "" : "s"}`}
          icon={<ChartIcon className="h-5 w-5" />}
        />
        <StatCard
          label="My commission"
          value={formatMoney(total(won, "commission"))}
          sublabel={`${formatMoney(total(wonMonth, "commission"))} this month`}
          icon={<CoinsIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting reply"
          value={sent.length}
          sublabel="quotes sent"
          icon={<SendIcon className="h-5 w-5" />}
        />
      </div>

      {approvalIssues.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          {approvalIssues.map((q) => (
            <Link key={q.id} href={`/crm/quotes/${q.id}`} className="block hover:underline">
              {q.number} ({q.customer.company || q.customer.name}):{" "}
              {q.approvalStatus === "PENDING" ? "waiting for your manager's approval" : "discount not approved — adjust and save again"}
            </Link>
          ))}
        </div>
      )}

      {(demos.length > 0 || renewals.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {demos.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-black/5 font-semibold">📅 Demos this week</div>
              <div className="divide-y divide-black/5">
                {demos.map((c) => (
                  <Link key={c.id} href={`/crm/customers/${c.id}`} className="px-5 py-3 flex justify-between gap-3 text-sm hover:bg-sand-50">
                    <span className="font-medium truncate">{c.company || c.name}</span>
                    <span className="text-violet-700 whitespace-nowrap">
                      {c.demoAt!.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {renewals.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-black/5 font-semibold flex justify-between">
                <span>🔁 Renewals in 30 days</span>
                <Link href="/crm/subscriptions" className="text-sm font-normal text-brand-600 hover:underline">
                  All →
                </Link>
              </div>
              <div className="divide-y divide-black/5">
                {renewals.map((r) => (
                  <Link key={r.id} href={`/crm/customers/${r.customer.id}`} className="px-5 py-3 flex justify-between gap-3 text-sm hover:bg-sand-50">
                    <span className="font-medium truncate">{r.customer.company || r.customer.name}</span>
                    <span className="text-black/55 whitespace-nowrap">
                      {r.renewalDate.toLocaleDateString("en-GB")} · {formatMoney(r.monthlyValue)}/mo
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-brand-500" /> Follow-ups due
            </h2>
            <Link href="/crm/customers?due=1&stage=OPEN" className="text-sm text-brand-600 hover:underline">
              All →
            </Link>
          </div>
          {dueLeads.length === 0 ? (
            <div className="px-5 py-10 text-center text-black/40 text-sm">
              You&apos;re all caught up. Set a follow-up date on a lead and it shows up here on the day.
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {dueLeads.map((c) => {
                const f = followUpLabel(c.nextFollowUpAt!);
                return (
                  <Link
                    key={c.id}
                    href={`/crm/customers/${c.id}`}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-sand-50"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.company || c.name}</div>
                      <div className="text-xs text-black/40 mt-0.5">
                        {c.company ? `${c.name} · ` : ""}
                        {c.phone || c.email || "no contact details"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-medium ${f.overdue ? "text-rose-600" : "text-amber-600"}`}>
                        {f.text}
                      </span>
                      <Badge variant={c.status}>{LEAD_STATUS_LABEL[c.status]}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="px-5 py-4 border-b border-black/5">
              <h2 className="font-semibold flex items-center gap-2">
                <EyeIcon className="h-4 w-4 text-emerald-500" /> Hot: clients opened your materials
              </h2>
            </div>
            {opened.length === 0 ? (
              <div className="px-5 py-6 text-sm text-black/40">
                When a client opens a deck or demo you sent, they&apos;ll show up here — call them while it&apos;s fresh.
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {opened.map((s) => (
                  <Link key={s.id} href={`/crm/customers/${s.customer.id}`} className="block px-5 py-3 hover:bg-sand-50">
                    <div className="text-sm font-medium truncate">{s.customer.company || s.customer.name}</div>
                    <div className="text-xs text-black/45 truncate">
                      {s.material.title} · {s.views}× · {timeAgo(s.lastViewedAt!)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {quietLeads.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-black/5">
                <h2 className="font-semibold flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-amber-500" /> Gone quiet ({QUIET_DAYS}+ days)
                </h2>
              </div>
              <div className="divide-y divide-black/5">
                {quietLeads.map((c) => (
                  <Link key={c.id} href={`/crm/customers/${c.id}`} className="block px-5 py-3 hover:bg-sand-50">
                    <div className="text-sm font-medium truncate">{c.company || c.name}</div>
                    <div className="text-xs text-black/45">
                      {c.lastContactAt ? `last contact ${timeAgo(c.lastContactAt)}` : "never contacted"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">My products</h2>
              <Link href="/crm/products" className="text-xs text-brand-600 hover:underline">
                All →
              </Link>
            </div>
            {products.length === 0 ? (
              <p className="text-sm text-black/40">None assigned yet — ask your manager.</p>
            ) : (
              <div className="space-y-2">
                {products.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href={`/crm/products/${p.id}`}
                    className="flex items-center gap-2.5 text-sm hover:text-brand-600"
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color || "#4f46e5" }} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
