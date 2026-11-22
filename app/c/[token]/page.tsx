import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { formatDate, formatMoney } from "@/lib/format";
import { proformaLines } from "@/lib/contracts";
import SignPanel from "./SignPanel";
import { getRevolutOrder, revolutEnabled } from "@/lib/revolut";
import { markProformaPaid } from "@/lib/contract-signing";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Pogodba" };

/** Public contract page: read, then sign with a code from e-mail (no login; the token is the key). */
export default async function PublicContractPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { placano?: string };
}) {
  // Back from the Revolut checkout: confirm the payment straight away (the webhook may still be on its way).
  if (searchParams.placano) {
    const pending = await prisma.contract.findUnique({ where: { publicToken: params.token }, select: { id: true, revolutOrderId: true, paidAt: true } });
    if (pending?.revolutOrderId && !pending.paidAt && revolutEnabled()) {
      try {
        const o = await getRevolutOrder(pending.revolutOrderId);
        if (o.state === "completed") await markProformaPaid(pending.id, "Revolut card payment");
      } catch {
        /* the webhook will catch up */
      }
    }
  }
  const c = await prisma.contract.findUnique({
    where: { publicToken: params.token },
    include: { quote: { include: { items: true } }, user: true, customer: true },
  });
  if (!c || c.status === "CANCELLED") notFound();
  const s = await getSettings();

  if (!c.viewedAt && c.status === "SENT") {
    await prisma.contract.update({ where: { id: c.id }, data: { viewedAt: new Date() } });
    await logActivity(c.customerId, null, "NOTE", `Client opened contract ${c.number}`);
    await notify([c.userId], {
      type: "CONTRACT_VIEWED",
      title: `${c.clientCompany || c.customer.name} opened contract ${c.number}`,
      body: "Good moment for a quick call.",
      link: `/crm/contracts/${c.id}`,
    });
  }
  const pf = proformaLines(c.quote, s.legalVatPayer);

  return (
    <div className="min-h-screen bg-sand-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <div className="text-xl font-semibold text-brand-600">{s.legalName}</div>
            <div className="text-sm text-black/45">
              {c.title} · {c.number}
            </div>
          </div>
          <a href={`/c/${params.token}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
            Prenesi PDF
          </a>
        </div>

        <div className="card p-6 sm:p-8 mb-4">
          <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-black/80">{c.body}</div>
        </div>

        {c.status === "SIGNED" ? (
          <div className="card p-6">
            <div className="text-2xl mb-1">✅</div>
            <div className="font-semibold text-emerald-700">Pogodba je podpisana</div>
            <p className="text-sm text-black/60 mt-1">
              Podpisal(a) {c.signedName}
              {c.signedAt ? `, ${formatDate(c.signedAt)}` : ""}. Podpisano pogodbo in predračun smo poslali na {c.signedEmail}.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <a href={`/c/${params.token}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
                Podpisana pogodba (PDF)
              </a>
              {c.proformaNumber && (
                <a href={`/c/${params.token}/predracun`} target="_blank" rel="noreferrer" className="btn-primary">
                  Predračun {c.proformaNumber} (PDF)
                </a>
              )}
            </div>
            {c.proformaNumber && (
              <div className="mt-5 text-sm rounded-xl bg-sand-50 p-4 space-y-0.5">
                <div className="font-medium mb-1">Plačilo</div>
                <div>Znesek: <b>{formatMoney(pf.total)}</b>{c.proformaDueAt ? ` · rok ${formatDate(c.proformaDueAt)}` : ""}</div>
                <div>Prejemnik: {s.legalName}</div>
                <div>IBAN: {s.legalIban || "—"}</div>
                <div>Referenca: {c.paymentReference}</div>
                {c.paymentLinkUrl && !c.paidAt && (
                  <a href={c.paymentLinkUrl} className="btn-primary mt-3 inline-flex">Plačaj s kartico</a>
                )}
                {c.paidAt && <div className="text-emerald-700 font-medium mt-2">Plačano — hvala!</div>}
              </div>
            )}
          </div>
        ) : c.status === "SENT" ? (
          <SignPanel token={params.token} email={c.clientEmail || ""} />
        ) : (
          <div className="card p-6 text-center text-sm text-black/60">Pogodba še ni pripravljena za podpis.</div>
        )}

        <p className="text-xs text-black/35 mt-6 text-center">
          Vaš kontakt: {c.user.name} · {c.user.email}
          {c.user.phone ? ` · ${c.user.phone}` : ""}
        </p>
      </div>
    </div>
  );
}
