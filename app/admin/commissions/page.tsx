import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { computeStatements, isValidPeriod, parseTiers, periodLabel, periodOf, recentPeriods } from "@/lib/commission";
import { formatMoney } from "@/lib/format";
import PayoutButton from "./PayoutButton";

export const dynamic = "force-dynamic";

export default async function CommissionsPage({ searchParams }: { searchParams: { period?: string } }) {
  const user = await requireStaff();
  const period = isValidPeriod(searchParams.period) ? searchParams.period : periodOf(new Date());
  const sellerIds = await getManagedSellerIds(user);
  const [sellers, statements, settings] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true, active: true, commissionRate: true },
      orderBy: { name: "asc" },
    }),
    computeStatements(sellerIds, period),
    getSettings(),
  ]);
  const byId = new Map(statements.map((s) => [s.userId, s]));
  const tiers = parseTiers(settings.commissionTiers);
  const totals = statements.reduce(
    (t, s) => ({ earned: t.earned + s.earned, paid: t.paid + s.paid, won: t.won + s.wonValue }),
    { earned: 0, paid: 0, won: 0 }
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commission statements</h1>
          <p className="text-black/50 text-sm mt-1">
            Earned = commission on quotes accepted in the month + renewal commission + tier bonus.
            {tiers.length > 0
              ? ` Bonus tiers: ${tiers.map((t) => `${t.rate}% from ${formatMoney(t.min)}`).join(", ")}.`
              : " No bonus tiers set (Settings)."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {recentPeriods(12).map((p) => (
          <Link key={p} href={`/admin/commissions?period=${p}`} className={p === period ? "chip-active" : "chip"}>
            {periodLabel(p)}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-5 py-3 font-medium">Seller</th>
              <th className="px-3 py-3 font-medium text-right">Won (1st-yr)</th>
              <th className="px-3 py-3 font-medium text-right">Deals</th>
              <th className="px-3 py-3 font-medium text-right">Renewals</th>
              <th className="px-3 py-3 font-medium text-right">Bonus</th>
              <th className="px-3 py-3 font-medium text-right">Earned</th>
              <th className="px-3 py-3 font-medium text-right">Paid</th>
              <th className="px-3 py-3 font-medium text-right">Balance</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {sellers.map((u) => {
              const s = byId.get(u.id)!;
              return (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-black/40">
                      {s.deals.length} deal{s.deals.length === 1 ? "" : "s"}
                      {u.commissionRate !== null ? ` · personal rate ${u.commissionRate}%` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">{formatMoney(s.wonValue)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(s.quoteCommission)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(s.renewalCommission)}</td>
                  <td className="px-3 py-3 text-right">
                    {formatMoney(s.bonus)}
                    {s.bonusRate > 0 && <span className="block text-[11px] text-black/40">{s.bonusRate}%</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">{formatMoney(s.earned)}</td>
                  <td className="px-3 py-3 text-right text-black/60">{formatMoney(s.paid)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${s.balance > 0.005 ? "text-amber-700" : "text-emerald-700"}`}>
                    {formatMoney(s.balance)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {user.role === "ADMIN" && (
                      <PayoutButton
                        userId={u.id}
                        name={u.name}
                        period={period}
                        balance={s.balance}
                        payouts={s.payouts.map((p) => ({ ...p, paidAt: p.paidAt.toISOString() }))}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-black/40">No sellers yet.</td>
              </tr>
            )}
          </tbody>
          {sellers.length > 0 && (
            <tfoot>
              <tr className="border-t border-black/10 font-semibold">
                <td className="px-5 py-3">Total</td>
                <td className="px-3 py-3 text-right">{formatMoney(totals.won)}</td>
                <td colSpan={3} />
                <td className="px-3 py-3 text-right">{formatMoney(totals.earned)}</td>
                <td className="px-3 py-3 text-right">{formatMoney(totals.paid)}</td>
                <td className="px-3 py-3 text-right">{formatMoney(totals.earned - totals.paid)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {user.role !== "ADMIN" && (
        <p className="text-xs text-black/40 mt-3">Payouts are recorded by an admin.</p>
      )}
    </div>
  );
}
