import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import StatCard from "@/components/StatCard";
import { CoinsIcon, ChartIcon, CheckCircleIcon } from "@/components/icons";
import { computeStatement, isValidPeriod, parseTiers, periodLabel, periodOf, recentPeriods } from "@/lib/commission";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MyCommissionPage({ searchParams }: { searchParams: { period?: string } }) {
  const user = await requireSales();
  const period = isValidPeriod(searchParams.period) ? searchParams.period : periodOf(new Date());
  const periods = recentPeriods(12);

  const [s, history, settings, me] = await Promise.all([
    computeStatement(user.id, period),
    Promise.all(periods.map((p) => computeStatement(user.id, p))),
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { commissionRate: true } }),
  ]);
  const tiers = parseTiers(settings.commissionTiers);
  const nextTier = tiers.find((t) => t.min > s.paidValue);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My commission</h1>
        <p className="text-black/50 text-sm mt-1">
          You earn commission on what your customers actually pay, every month, for the first{" "}
          {settings.commissionMonths} months after they accept a quote (own leads: at least {settings.ownLeadCommissionRate}%).
          UGC video pay is added here too.
          {me?.commissionRate !== null && me?.commissionRate !== undefined
            ? ` Your personal rate is ${me.commissionRate}% on all products.`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {periods.map((p) => (
          <Link key={p} href={`/crm/commission?period=${p}`} className={p === period ? "chip-active" : "chip"}>
            {periodLabel(p)}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard tone="dark" label="Earned" value={formatMoney(s.earned)} sublabel={periodLabel(period)} icon={<CoinsIcon className="h-5 w-5" />} />
        <StatCard label="Paid out" value={formatMoney(s.paid)} sublabel={s.payouts.length ? `${s.payouts.length} payment(s)` : "nothing yet"} icon={<CheckCircleIcon className="h-5 w-5" />} />
        <StatCard tone="accent" label="Open balance" value={formatMoney(s.balance)} sublabel="still to be paid" icon={<CoinsIcon className="h-5 w-5" />} />
        <StatCard label="Paid by customers" value={formatMoney(s.paidValue)} sublabel={`${s.wonCount} new deal${s.wonCount === 1 ? "" : "s"} · ${formatMoney(s.wonValue)} won`} icon={<ChartIcon className="h-5 w-5" />} />
      </div>

      {tiers.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Bonus tier: <strong>{s.bonusRate > 0 ? `${s.bonusRate}% bonus` : "none yet"}</strong>
              {s.bonus > 0 && ` (${formatMoney(s.bonus)})`}
            </span>
            {nextTier && (
              <span className="text-black/55">
                {formatMoney(nextTier.min - s.paidValue)} more paid this month → {nextTier.rate}% bonus
              </span>
            )}
          </div>
          {nextTier && (
            <div className="h-2 rounded-full bg-black/5 mt-3 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (s.paidValue / nextTier.min) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card lg:col-span-2">
          <div className="px-5 py-4 border-b border-black/5 font-semibold">Customer payments ({s.payments.length})</div>
          {s.payments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-black/40">No customer payments in {periodLabel(period)}.</div>
          ) : (
            <div className="divide-y divide-black/5">
              {s.payments.map((d) => (
                <Link key={d.id} href={`/crm/quotes/${d.quoteId}`} className="px-5 py-3 flex justify-between gap-3 hover:bg-sand-50 text-sm">
                  <span>
                    <span className="font-medium">{d.customer}</span>
                    <span className="block text-xs text-black/40">
                      {d.number} · paid {formatDate(d.paidAt)} · {formatMoney(d.amount)} × {d.rate}%
                    </span>
                  </span>
                  <span className="font-semibold text-emerald-700">{formatMoney(d.commission)}</span>
                </Link>
              ))}
            </div>
          )}
          {s.ugc.length > 0 && (
            <>
              <div className="px-5 py-3 border-y border-black/5 section-title">UGC videos</div>
              <div className="divide-y divide-black/5">
                {s.ugc.map((u) => (
                  <div key={u.id} className="px-5 py-3 flex justify-between text-sm">
                    <span>
                      {u.title}
                      <span className="block text-xs text-black/40">
                        {u.kind === "VIDEO" ? "Published" : `View bonus · ${(u.views || 0).toLocaleString("sl-SI")} views`} · {formatDate(u.date)}
                      </span>
                    </span>
                    <span className="font-semibold text-emerald-700">{formatMoney(u.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-black/5 font-semibold">Last 12 months</div>
          <div className="divide-y divide-black/5">
            {history.map((h) => (
              <Link
                key={h.period}
                href={`/crm/commission?period=${h.period}`}
                className={`px-5 py-2.5 flex justify-between text-sm hover:bg-sand-50 ${h.period === period ? "bg-brand-50/50" : ""}`}
              >
                <span>{periodLabel(h.period)}</span>
                <span className="text-right">
                  {formatMoney(h.earned)}
                  {h.balance > 0.005 && <span className="block text-[11px] text-amber-600">{formatMoney(h.balance)} open</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
