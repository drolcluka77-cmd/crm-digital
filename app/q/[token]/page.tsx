import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { computeQuoteBreakdown, formatDate, formatMoney } from "@/lib/format";
import { BILLING_LABEL, BILLING_SUFFIX } from "@/lib/constants";
import AcceptPanel from "./AcceptPanel";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Public quote page the client opens from the email (no login). */
export default async function PublicQuotePage({ params }: { params: { token: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    include: { items: true, customer: true, user: true },
  });
  if (!quote) notFound();
  const settings = await getSettings();

  // First open → tell the seller.
  if (!quote.viewedAt) {
    await prisma.quote.update({ where: { id: quote.id }, data: { viewedAt: new Date() } });
    await logActivity(quote.customerId, null, "QUOTE_VIEWED", `Opened ${quote.number} online`);
    await notify([quote.userId], {
      type: "QUOTE_VIEWED",
      title: `${quote.customer.company || quote.customer.name} opened ${quote.number}`,
      body: "Good moment for a quick call.",
      link: `/crm/quotes/${quote.id}`,
    });
  }

  const b = computeQuoteBreakdown(quote.items, quote.discount, quote.vatRate);
  const expired = !!quote.validUntil && quote.validUntil < new Date();
  const revising = quote.approvalStatus === "PENDING" || quote.approvalStatus === "REJECTED";
  const state: "open" | "accepted" | "declined" | "expired" | "revising" =
    quote.status === "ACCEPTED"
      ? "accepted"
      : quote.status === "REJECTED"
        ? "declined"
        : expired
          ? "expired"
          : revising
            ? "revising"
            : "open";

  return (
    <div className="min-h-screen bg-sand-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt={settings.companyName} className="h-10 mb-2" />
            ) : (
              <div className="text-xl font-semibold text-brand-600">{settings.companyName}</div>
            )}
            <div className="text-sm text-black/45">
              Quote {quote.number} · {formatDate(quote.createdAt)}
              {quote.validUntil && ` · valid until ${formatDate(quote.validUntil)}`}
            </div>
          </div>
          <a href={`/q/${params.token}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
            Download PDF
          </a>
        </div>

        <div className="card p-6 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="section-title mb-1">Prepared for</div>
              {quote.customer.company && <div className="font-semibold">{quote.customer.company}</div>}
              <div>{quote.customer.name}</div>
            </div>
            <div>
              <div className="section-title mb-1">Your contact</div>
              <div className="font-semibold">{quote.user.name}</div>
              <div className="text-black/60">{quote.user.email}</div>
              {quote.user.phone && <div className="text-black/60">{quote.user.phone}</div>}
            </div>
          </div>
        </div>

        <div className="card mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-3 py-3 font-medium text-right">Qty</th>
                <th className="px-3 py-3 font-medium text-right">Price</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {quote.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3">
                    {i.name}
                    {i.unitLabel && <div className="text-xs text-black/40">{i.unitLabel}</div>}
                  </td>
                  <td className="px-3 py-3 text-right">{i.quantity}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatMoney(i.unitPrice)}
                    {BILLING_SUFFIX[i.billing]}
                  </td>
                  <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
                    {formatMoney(i.quantity * i.unitPrice)}
                    {BILLING_SUFFIX[i.billing]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-black/5 px-5 py-4 grid gap-4 sm:grid-cols-2">
            {b.groups.map((g) => {
              const sfx = BILLING_SUFFIX[g.billing];
              return (
                <div key={g.billing} className="text-sm space-y-1">
                  <div className="section-title text-brand-600">{BILLING_LABEL[g.billing]}</div>
                  <div className="flex justify-between text-black/55">
                    <span>Subtotal</span>
                    <span>{formatMoney(g.subtotal) + sfx}</span>
                  </div>
                  {quote.discount > 0 && (
                    <div className="flex justify-between text-black/55">
                      <span>Discount ({quote.discount}%)</span>
                      <span>-{formatMoney(g.discountAmount) + sfx}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-black/55">
                    <span>VAT ({quote.vatRate}%)</span>
                    <span>{formatMoney(g.vatAmount) + sfx}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-1 border-t border-black/5">
                    <span>Total</span>
                    <span>{formatMoney(g.total) + sfx}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {quote.notes && (
          <div className="card p-5 mb-4">
            <div className="section-title mb-1.5">Notes & terms</div>
            <p className="text-sm text-black/65 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        <AcceptPanel
          token={params.token}
          state={state}
          acceptedBy={quote.acceptedByName}
          decidedAt={quote.decidedAt?.toISOString() ?? null}
          contactName={quote.user.name}
        />
      </div>
    </div>
  );
}
