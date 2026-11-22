import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/url";
import { sendEmail } from "@/lib/mailer";
import { escapeHtml, formatDate, formatMoney } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { notify, supervisorsOf } from "@/lib/notify";
import { acceptQuote } from "@/lib/quotes";
import { hashDocument, nextProformaNumber, paymentReferenceFor, proformaLines } from "@/lib/contracts";
import { renderContractPdf, renderProformaPdf } from "@/lib/contract-pdf";
import { createRevolutOrder, revolutEnabled } from "@/lib/revolut";

/** Creates a Revolut card-payment link for a signed contract's proforma (once). Returns the link or null. */
export async function ensurePaymentLink(contractId: string, baseUrl: string): Promise<string | null> {
  if (!revolutEnabled()) return null;
  const c = await prisma.contract.findUnique({ where: { id: contractId }, include: { quote: { include: { items: true } } } });
  if (!c || !c.proformaNumber || c.paidAt) return c?.paymentLinkUrl ?? null;
  if (c.paymentLinkUrl) return c.paymentLinkUrl;
  const s = await getSettings();
  const total = proformaLines(c.quote, s.legalVatPayer).total;
  if (total <= 0) return null;
  const order = await createRevolutOrder({
    amount: total,
    description: `Predračun ${c.proformaNumber} (pogodba ${c.number}) — ${c.clientCompany || ""}`.trim(),
    reference: c.proformaNumber,
    email: c.clientEmail,
    redirectUrl: `${baseUrl}/c/${c.publicToken}?placano=1`,
  });
  await prisma.contract.update({ where: { id: c.id }, data: { revolutOrderId: order.id, paymentLinkUrl: order.checkoutUrl } });
  return order.checkoutUrl;
}

/** Called when Revolut confirms the payment. */
export async function markProformaPaid(contractId: string, how: string) {
  const c = await prisma.contract.findUnique({ where: { id: contractId }, include: { customer: true } });
  if (!c || c.paidAt) return;
  await prisma.contract.update({ where: { id: c.id }, data: { paidAt: new Date() } });
  await logActivity(c.customerId, null, "PAYMENT", `Proforma ${c.proformaNumber} paid (${how})`);
  const who = c.clientCompany || c.customer.company || c.customer.name;
  await notify([c.userId], { type: "PAYMENT", title: `💶 ${who} paid proforma ${c.proformaNumber}`, link: `/crm/contracts/${c.id}` });
  await notify(await supervisorsOf(c.userId), {
    type: "PAYMENT",
    title: `💶 ${who} paid proforma ${c.proformaNumber} (${how})`,
    body: "Record the payment under Payments for commission.",
    link: `/admin/contracts/${c.id}`,
  });
}

const fullInclude = { quote: { include: { items: true } }, customer: true, user: true, reviewedBy: { select: { name: true } } } as const;

export async function contractPdfFor(contractId: string) {
  const c = await prisma.contract.findUnique({ where: { id: contractId }, include: fullInclude });
  if (!c) return null;
  const s = await getSettings();
  return { contract: c, bytes: await renderContractPdf(c, { legalName: s.legalName, legalRepresentative: s.legalRepresentative }) };
}

export async function proformaPdfFor(contractId: string) {
  const c = await prisma.contract.findUnique({ where: { id: contractId }, include: fullInclude });
  if (!c || !c.proformaNumber || !c.proformaIssuedAt || !c.proformaDueAt) return null;
  const s = await getSettings();
  const bytes = await renderProformaPdf(
    {
      proformaNumber: c.proformaNumber,
      proformaIssuedAt: c.proformaIssuedAt,
      proformaDueAt: c.proformaDueAt,
      paymentReference: c.paymentReference || paymentReferenceFor(c.proformaNumber),
      paymentLinkUrl: c.paymentLinkUrl,
      contractNumber: c.number,
      client: { company: c.clientCompany || c.customer.company || c.customer.name, address: c.clientAddress, regNo: c.clientRegNo, vatId: c.clientVatId },
      quote: c.quote,
    },
    s
  );
  return { contract: c, bytes };
}

/** After the client signs: record it, win the quote, issue the proforma, send both PDFs. */
export async function completeSigning(
  contractId: string,
  sig: { name: string; title: string | null; ip: string | null; userAgent: string | null }
) {
  const c = await prisma.contract.findUnique({ where: { id: contractId }, include: fullInclude });
  if (!c) throw new Error("Contract not found");
  const s = await getSettings();
  const now = new Date();
  const due = new Date(now.getTime() + (s.proformaDueDays || 8) * 86_400_000);

  let proformaNumber: string | null = null;
  for (let attempt = 0; attempt < 3 && !proformaNumber; attempt++) {
    const n = await nextProformaNumber();
    try {
      await prisma.contract.update({
        where: { id: c.id },
        data: {
          status: "SIGNED",
          signedName: sig.name,
          signedTitle: sig.title,
          signedEmail: c.clientEmail,
          signedAt: now,
          signedIp: sig.ip,
          signedUserAgent: sig.userAgent?.slice(0, 300) || null,
          documentHash: hashDocument(c.body),
          codeHash: null,
          codeExpiresAt: null,
          proformaNumber: n,
          proformaIssuedAt: now,
          proformaDueAt: due,
          paymentReference: paymentReferenceFor(n),
        },
      });
      proformaNumber = n;
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }
  }
  if (!proformaNumber) throw new Error("Couldn't number the proforma");

  if (c.quote.status !== "ACCEPTED") {
    await acceptQuote(c.quoteId, { userId: null, name: sig.name, title: sig.title || undefined, ip: sig.ip || undefined });
  }
  await logActivity(c.customerId, null, "CONTRACT_SIGNED", `Contract ${c.number} signed online by ${sig.name} · proforma ${proformaNumber} issued`);

  const total = proformaLines(c.quote, s.legalVatPayer).total;
  let payLink: string | null = null;
  try {
    payLink = await ensurePaymentLink(c.id, getBaseUrl());
  } catch (e) {
    console.error("Revolut payment link failed", e);
  }
  const [contractPdf, proformaPdf] = await Promise.all([contractPdfFor(c.id), proformaPdfFor(c.id)]);
  const link = `${getBaseUrl()}/c/${c.publicToken}`;
  const text = `Pozdravljeni,

hvala za podpis pogodbe ${c.number}. V prilogi sta podpisana pogodba in predračun ${proformaNumber}.

Za plačilo: ${formatMoney(total)}
Rok plačila: ${formatDate(due)}
Prejemnik: ${s.legalName}
IBAN: ${s.legalIban || "—"}
Referenca: ${paymentReferenceFor(proformaNumber)}

Predračun lahko plačate tudi tako, da v mobilni banki skenirate UPN QR kodo na predračunu.${payLink ? `\n\nPlačilo s kartico (Revolut): ${payLink}` : ""}

Dokumenta sta vedno na voljo tudi tukaj: ${link}

Lep pozdrav,
${c.user.name}
${s.legalName}`;
  try {
    await sendEmail({
      to: c.clientEmail!,
      subject: `Podpisana pogodba ${c.number} in predračun ${proformaNumber}`,
      text,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2430">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`,
      replyTo: c.user.email,
      attachments: [
        ...(contractPdf ? [{ filename: `${c.number}.pdf`, content: Buffer.from(contractPdf.bytes), contentType: "application/pdf" }] : []),
        ...(proformaPdf ? [{ filename: `${proformaNumber}.pdf`, content: Buffer.from(proformaPdf.bytes), contentType: "application/pdf" }] : []),
      ],
    });
  } catch (e) {
    console.error("Contract signed, but the confirmation e-mail failed", e);
  }

  const who = c.clientCompany || c.customer.name;
  await notify([c.userId], {
    type: "CONTRACT_SIGNED",
    title: `🎉 ${who} signed contract ${c.number}`,
    body: `Proforma ${proformaNumber}: ${formatMoney(total)}, due ${formatDate(due)}.`,
    link: `/crm/contracts/${c.id}`,
  });
  await notify(await supervisorsOf(c.userId), {
    type: "CONTRACT_SIGNED",
    title: `${who} signed contract ${c.number}`,
    body: `Proforma ${proformaNumber}: ${formatMoney(total)}, due ${formatDate(due)}.`,
    link: `/admin/contracts/${c.id}`,
  });
}
