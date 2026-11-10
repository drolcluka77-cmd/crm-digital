import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import { UsersIcon, PackageIcon, ChartIcon, CoinsIcon, ClockIcon } from "@/components/icons";
import { computeQuoteBreakdown, formatMoney, timeAgo } from "@/lib/format";
import { ACTIVITY_TYPE_LABEL, OPEN_LEAD_STATUSES, QUOTE_STATUS_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ConsoleDashboardPage() {
  const user = await requireStaff();
  const sellerIds = await getManagedSellerIds(user);
  const scope = { in: sellerIds };

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [sellers, productCount, customerCount, quotes, overdue, activities, subs, pendingApprovals] = await Promise.all([
    prisma.user.findMany({ where: { id: scope, active: true }, select: { id: true, name: true } }),
    prisma.product.count({ where: { active: true } }),
    prisma.customer.count({ where: { ownerId: scope } }),
    prisma.quote.findMany({
      where: { userId: scope },
      include: { items: { include: { product: { select: { id: true, name: true } } } }, customer: true, user: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.customer.count({
      where: {
        ownerId: scope,
        status: { in: [...OPEN_LEAD_STATUSES] },
        nextFollowUpAt: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.activity.findMany({
      where: { customer: { ownerId: scope } },
      include: { customer: { select: { id: true, name: true, company: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.subscription.findMany({ where: { userId: scope, status: "ACTIVE" }, select: { monthlyValue: true } }),
    prisma.quote.count({ where: { userId: scope, approvalStatus: "PENDING" } }),
  ]);
  const mrr = subs.reduce((s, x) => s + x.monthlyValue, 0);

  const withValue = quotes.map((q) => ({ q, b: computeQuoteBreakdown(q.items, q.discount, q.vatRate) }));
  const open = withValue.filter(({ q }) => q.status === "DRAFT" || q.status === "SENT");
  const accepted = withValue.filter(({ q }) => q.status === "ACCEPTED");
  const decided = withValue.filter(({ q }) => q.status === "ACCEPTED" || q.status === "REJECTED");
  const sum = (list: typeof withValue, key: "annualNet" | "commission") =>
    list.reduce((s, x) => s + x.b[key], 0);
  const wonThisMonth = accepted.filter(({ q }) => (q.decidedAt || q.updatedAt) >= startOfMonth);

  // Leaderboard per seller.
  const board = sellers
    .map((s) => {
      const mine = withValue.filter(({ q }) => q.userId === s.id);
      const won = mine.filter(({ q }) => q.status === "ACCEPTED");
      return {
        ...s,
        open: sum(mine.filter(({ q }) => q.status === "DRAFT" || q.status === "SENT"), "annualNet"),
        won: sum(won, "annualNet"),
        commission: sum(won, "commission"),
        deals: won.length,
      };
    })
    .sort((a, b) => b.won - a.won || b.open - a.open);

  // Won value per product (line-level, after discount).
  const byProduct = new Map<string, { name: string; won: number; open: number }>();
  for (const { q } of withValue) {
    if (q.status === "REJECTED") continue;
    for (const i of q.items) {
      if (!i.product) continue;
      const v = computeQuoteBreakdown([i], q.discount, 0).annualNet;
      const row = byProduct.get(i.product.id) || { name: i.product.name, won: 0, open: 0 };
      if (q.status === "ACCEPTED") row.won += v;
      else row.open += v;
      byProduct.set(i.product.id, row);
    }
  }
  const productRows = Array.from(byProduct.values()).sort((a, b) => b.won + b.open - (a.won + a.open));

  return (
    <div>
      {pendingApprovals > 0 && (
        <Link
          href="/admin/approvals"
          className="block mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          {pendingApprovals} quote{pendingApprovals === 1 ? " is" : "s are"} waiting for your discount approval →
        </Link>
      )}
      <div className="mb-8">
        <div className="section-title mb-1">{user.role === "ADMIN" ? "Whole company" : "Your team"}</div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-black/50 mt-1">
          Pipeline, wins and activity across {user.role === "ADMIN" ? "all sellers" : "your sellers"}. Values are
          first-year, excl. VAT.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Active sellers" value={sellers.length} icon={<UsersIcon className="h-5 w-5" />} />
        <StatCard
          label="MRR"
          value={formatMoney(mrr)}
          sublabel={`${subs.length} active subscriptions · ${productCount} live products`}
          icon={<PackageIcon className="h-5 w-5" />}
        />
        <StatCard label="Customers" value={customerCount} sublabel="owned by these sellers" icon={<UsersIcon className="h-5 w-5" />} />
        <StatCard
          label="Overdue follow-ups"
          value={overdue}
          sublabel="leads past their follow-up date"
          icon={<ClockIcon className="h-5 w-5" />}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          tone="dark"
          label="Open pipeline"
          value={formatMoney(sum(open, "annualNet"))}
          sublabel={`${open.length} draft / sent quotes`}
          icon={<ChartIcon className="h-5 w-5" />}
        />
        <StatCard
          tone="accent"
          label="Won this month"
          value={formatMoney(sum(wonThisMonth, "annualNet"))}
          sublabel={`${wonThisMonth.length} deals · ${formatMoney(sum(accepted, "annualNet"))} all time`}
          icon={<ChartIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Commission earned"
          value={formatMoney(sum(accepted, "commission"))}
          sublabel="on accepted quotes"
          icon={<CoinsIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Win rate"
          value={decided.length ? `${Math.round((accepted.length / decided.length) * 100)}%` : "—"}
          sublabel="accepted / decided quotes"
          icon={<ChartIcon className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold">Seller leaderboard</h2>
            <Link href="/admin/team" className="text-sm text-brand-600 hover:underline">
              Team →
            </Link>
          </div>
          {board.length === 0 ? (
            <div className="px-6 py-10 text-center text-black/40 text-sm">No sellers yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-black/40">
                  <th className="px-6 py-2 font-medium">Seller</th>
                  <th className="px-2 py-2 font-medium text-right">Open</th>
                  <th className="px-2 py-2 font-medium text-right">Won</th>
                  <th className="px-6 py-2 font-medium text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {board.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-2.5 font-medium">
                      {s.name}
                      <span className="text-xs text-black/35 font-normal"> · {s.deals} deals</span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-black/60">{formatMoney(s.open)}</td>
                    <td className="px-2 py-2.5 text-right font-medium">{formatMoney(s.won)}</td>
                    <td className="px-6 py-2.5 text-right text-emerald-700">{formatMoney(s.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold">By product</h2>
            <Link href="/admin/products" className="text-sm text-brand-600 hover:underline">
              Products →
            </Link>
          </div>
          {productRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-black/40 text-sm">No quotes yet.</div>
          ) : (
            <div className="px-6 py-4 space-y-3">
              {productRows.map((p) => {
                const max = Math.max(...productRows.map((r) => r.won + r.open), 1);
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-black/50">
                        {formatMoney(p.won)} won · {formatMoney(p.open)} open
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 overflow-hidden flex">
                      <div className="bg-brand-500" style={{ width: `${(p.won / max) * 100}%` }} />
                      <div className="bg-brand-200" style={{ width: `${(p.open / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold">Latest quotes</h2>
          </div>
          {withValue.length === 0 ? (
            <div className="px-6 py-10 text-center text-black/40 text-sm">No quotes yet.</div>
          ) : (
            <div className="divide-y divide-black/5">
              {withValue.slice(0, 6).map(({ q, b }) => (
                <a
                  key={q.id}
                  href={`/api/quotes/${q.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-sand-50"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {q.customer.company || q.customer.name}
                    </div>
                    <div className="text-xs text-black/40 mt-0.5">
                      {q.number} · {q.user.name} · {timeAgo(q.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium">{formatMoney(b.annualNet)}</span>
                    <Badge variant={q.status}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold">Team activity</h2>
          </div>
          {activities.length === 0 ? (
            <div className="px-6 py-10 text-center text-black/40 text-sm">Nothing logged yet.</div>
          ) : (
            <div className="divide-y divide-black/5">
              {activities.map((a) => (
                <div key={a.id} className="px-6 py-3">
                  <div className="text-sm">
                    <span className="font-medium">{a.user?.name || "Client"}</span>{" "}
                    <span className="text-black/50">· {ACTIVITY_TYPE_LABEL[a.type] || a.type} ·</span>{" "}
                    {a.customer.company || a.customer.name}
                  </div>
                  {a.body && <div className="text-xs text-black/45 mt-0.5 line-clamp-1">{a.body}</div>}
                  <div className="text-[11px] text-black/30 mt-0.5">{timeAgo(a.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
