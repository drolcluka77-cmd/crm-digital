"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSales, type CurrentUser } from "@/lib/session";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { sendQuoteEmail } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import { getAccessibleProductIds, getSellableProductIds } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { notify, supervisorsOf } from "@/lib/notify";
import { acceptQuote, rejectQuote } from "@/lib/quotes";
import { checkDiscounts, describeIssues } from "@/lib/guardrails";
import { getBaseUrl } from "@/lib/url";
import { computeQuoteBreakdown, escapeHtml, formatMoney } from "@/lib/format";
import { BILLINGS, BILLING_LABEL, BILLING_SUFFIX, QUOTE_STATUSES } from "@/lib/constants";

export type ActionResult = { error?: string; success?: string; id?: string; url?: string } | void;

type ItemInput = {
  productId: string | null;
  planId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  billing: string;
  unitLabel: string | null;
};

type PreparedItem = ItemInput & {
  commissionRate: number;
  renewalCommissionRate: number;
  listPrice: number | null;
};

async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.quote.findFirst({
    where: { number: { startsWith: `Q-${year}-` } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const n = last ? Number(last.number.split("-")[2]) + 1 : 1;
  return `Q-${year}-${String(n).padStart(4, "0")}`;
}

function parseItems(raw: string): ItemInput[] {
  let parsed: any[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((i) => ({
      productId: i.productId ? String(i.productId) : null,
      planId: i.planId ? String(i.planId) : null,
      name: String(i.name || "").trim().slice(0, 200),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      billing: BILLINGS.includes(i.billing) ? i.billing : "ONE_TIME",
      unitLabel: i.unitLabel ? String(i.unitLabel).slice(0, 80) : null,
    }))
    .filter((i) => i.name);
}

/**
 * Checks every product line against the seller's access and certification,
 * and stamps commission rates and the plan's list price onto it (never
 * trusted from the client). Also works out whether the discount needs
 * manager approval.
 */
async function prepareItems(user: CurrentUser, items: ItemInput[], quoteDiscount: number) {
  const [accessible, sellable, me, settings] = await Promise.all([
    getAccessibleProductIds(user),
    getSellableProductIds(user),
    prisma.user.findUnique({ where: { id: user.id }, select: { commissionRate: true } }),
    getSettings(),
  ]);
  const productIds = Array.from(new Set(items.map((i) => i.productId).filter(Boolean))) as string[];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      commissionRate: true,
      renewalCommissionRate: true,
      maxDiscount: true,
      plans: { select: { id: true, price: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const out: PreparedItem[] = [];
  for (const i of items) {
    if (i.productId) {
      const p = byId.get(i.productId);
      if (!p || !accessible.includes(i.productId)) {
        return { error: `You don't have access to "${i.name}". Remove that line or ask your manager.` } as const;
      }
      if (!sellable.includes(i.productId)) {
        return { error: `Pass the ${p.name} certification quiz before quoting it (My products → ${p.name}).` } as const;
      }
      const plan = i.planId ? p.plans.find((pl) => pl.id === i.planId) : undefined;
      out.push({
        ...i,
        planId: plan ? plan.id : null,
        listPrice: plan ? plan.price : null,
        commissionRate: me?.commissionRate ?? p.commissionRate,
        renewalCommissionRate: p.renewalCommissionRate,
      });
    } else {
      out.push({ ...i, planId: null, listPrice: null, commissionRate: 0, renewalCommissionRate: 0 });
    }
  }

  const check = checkDiscounts(out, quoteDiscount, (pid) => {
    const p = pid ? byId.get(pid) : undefined;
    return p?.maxDiscount ?? settings.defaultMaxDiscount ?? null;
  });
  return { items: out, check } as const;
}

function readNumbers(formData: FormData, defaultVat: number) {
  const discount = Math.min(100, Math.max(0, Number(formData.get("discount") || 0) || 0));
  const vatRaw = formData.get("vatRate");
  const vatRate = Math.max(0, vatRaw === null || vatRaw === "" ? defaultVat : Number(vatRaw) || 0);
  return { discount, vatRate };
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const v = String(raw || "");
  if (!v) return null;
  const d = new Date(`${v}T23:59:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** After saving: request approval if the discount is above the limit (any edit re-requests it). */
async function applyApproval(
  quoteId: string,
  user: CurrentUser,
  check: { needsApproval: boolean; issues: { name: string; discount: number; max: number }[] }
) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { customer: true } });
  if (!quote) return;
  if (!check.needsApproval) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { approvalStatus: "NONE", approvalReason: null, approvalNote: null, approvedById: null, approvedAt: null },
    });
    return;
  }
  const reason = describeIssues(check.issues);
  // Same discounts as what the manager already approved → stays approved.
  if (quote.approvalStatus === "APPROVED" && quote.approvalReason === reason) return;
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      approvalStatus: "PENDING",
      approvalReason: reason,
      approvalNote: null,
      approvalRequestedAt: new Date(),
      approvedById: null,
      approvedAt: null,
    },
  });
  await notify(await supervisorsOf(user.id), {
    type: "APPROVAL_REQUESTED",
    title: `${user.name} needs approval for ${quote.number}`,
    body: `${quote.customer.company || quote.customer.name} — ${reason}`,
    link: "/admin/approvals",
  });
}

export async function createQuote(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const settings = await getSettings();

  const customerId = String(formData.get("customerId") || "");
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.ownerId !== user.id) return { error: "Choose a valid customer." };

  const items = parseItems(String(formData.get("items") || "[]"));
  if (items.length === 0) return { error: "Add at least one item to the quote." };
  const { discount, vatRate } = readNumbers(formData, settings.vatRate);
  const prepared = await prepareItems(user, items, discount);
  if ("error" in prepared) return { error: prepared.error };

  const validUntil =
    parseDate(formData.get("validUntil")) ??
    new Date(Date.now() + settings.quoteValidityDays * 86_400_000);

  const quote = await prisma.quote.create({
    data: {
      number: await nextQuoteNumber(),
      customerId,
      userId: user.id,
      status: "DRAFT",
      discount,
      vatRate,
      validUntil,
      notes: String(formData.get("notes") || "").trim() || null,
      items: { create: prepared.items },
    },
  });
  await applyApproval(quote.id, user, prepared.check);

  // Tag the lead with the quoted products so pipeline-by-product stays accurate.
  const productIds = Array.from(new Set(prepared.items.map((i) => i.productId).filter(Boolean))) as string[];
  for (const productId of productIds) {
    await prisma.customerProduct.upsert({
      where: { customerId_productId: { customerId, productId } },
      create: { customerId, productId },
      update: {},
    });
  }

  revalidatePath("/crm/quotes");
  revalidatePath("/crm");
  revalidatePath(`/crm/customers/${customerId}`);
  redirect(`/crm/quotes/${quote.id}`);
}

export async function updateQuote(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const settings = await getSettings();
  const id = String(formData.get("id") || "");
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return { error: "Quote not found." };
  if (existing.status === "ACCEPTED") return { error: "Accepted quotes are locked. Reopen it first." };

  const items = parseItems(String(formData.get("items") || "[]"));
  if (items.length === 0) return { error: "Add at least one item to the quote." };
  const { discount, vatRate } = readNumbers(formData, settings.vatRate);
  const prepared = await prepareItems(user, items, discount);
  if ("error" in prepared) return { error: prepared.error };

  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
    prisma.quote.update({
      where: { id },
      data: {
        discount,
        vatRate,
        validUntil: parseDate(formData.get("validUntil")) ?? existing.validUntil,
        notes: String(formData.get("notes") || "").trim() || null,
        items: { create: prepared.items },
      },
    }),
  ]);
  await applyApproval(id, user, prepared.check);

  revalidatePath(`/crm/quotes/${id}`);
  revalidatePath("/crm/quotes");
  revalidatePath("/admin/approvals");
  return {
    success: prepared.check.needsApproval
      ? "Saved. The discount is above your limit, so your manager has been asked to approve it."
      : "Quote saved.",
  };
}

function approvalBlock(q: { approvalStatus: string }): string | null {
  if (q.approvalStatus === "PENDING") return "This quote is waiting for your manager's approval of the discount.";
  if (q.approvalStatus === "REJECTED") return "Your manager declined this discount. Adjust the prices and save again.";
  return null;
}

export async function setQuoteStatus(id: string, status: string): Promise<ActionResult> {
  const user = await requireSales();
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return { error: "Quote not found." };
  if (!(QUOTE_STATUSES as readonly string[]).includes(status)) return { error: "Unknown status." };

  if (status === "ACCEPTED") {
    const blocked = approvalBlock(existing);
    if (blocked) return { error: blocked };
    await acceptQuote(id, { userId: user.id });
  } else if (status === "REJECTED") {
    await rejectQuote(id, { userId: user.id });
  } else {
    await prisma.quote.update({ where: { id }, data: { status, decidedAt: null } });
    // Reopening a won quote undoes its subscription (unless it already renewed).
    if (existing.status === "ACCEPTED") {
      const sub = await prisma.subscription.findUnique({ where: { quoteId: id }, include: { renewals: true } });
      if (sub && sub.renewals.length === 0) await prisma.subscription.delete({ where: { id: sub.id } });
    }
  }

  revalidatePath(`/crm/quotes/${id}`);
  revalidatePath("/crm/quotes");
  revalidatePath("/crm/customers");
  revalidatePath(`/crm/customers/${existing.customerId}`);
  revalidatePath("/crm");
}

export async function duplicateQuote(id: string): Promise<ActionResult> {
  const user = await requireSales();
  const settings = await getSettings();
  const q = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
  if (!q || q.userId !== user.id) return { error: "Quote not found." };

  const items: ItemInput[] = q.items.map((i) => ({
    productId: i.productId,
    planId: i.planId,
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    billing: i.billing,
    unitLabel: i.unitLabel,
  }));
  const prepared = await prepareItems(user, items, q.discount);
  if ("error" in prepared) return { error: prepared.error };

  const copy = await prisma.quote.create({
    data: {
      number: await nextQuoteNumber(),
      customerId: q.customerId,
      userId: user.id,
      status: "DRAFT",
      discount: q.discount,
      vatRate: q.vatRate,
      notes: q.notes,
      validUntil: new Date(Date.now() + settings.quoteValidityDays * 86_400_000),
      items: { create: prepared.items },
    },
  });
  await applyApproval(copy.id, user, prepared.check);
  revalidatePath("/crm/quotes");
  redirect(`/crm/quotes/${copy.id}`);
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  const user = await requireSales();
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return { error: "Quote not found." };
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/crm/quotes");
  revalidatePath("/crm");
  redirect("/crm/quotes");
}

async function ensurePublicToken(quoteId: string): Promise<string> {
  const q = await prisma.quote.findUnique({ where: { id: quoteId }, select: { publicToken: true } });
  if (q?.publicToken) return q.publicToken;
  const token = randomBytes(18).toString("base64url");
  await prisma.quote.update({ where: { id: quoteId }, data: { publicToken: token } });
  return token;
}

/** Link the client can open to view, accept or decline the quote online. */
export async function getAcceptanceLink(id: string): Promise<ActionResult> {
  const user = await requireSales();
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q || q.userId !== user.id) return { error: "Quote not found." };
  const blocked = approvalBlock(q);
  if (blocked) return { error: blocked };
  const token = await ensurePublicToken(id);
  return { url: `${getBaseUrl()}/q/${token}` };
}

export async function sendQuoteByEmail(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();

  const id = String(formData.get("id") || "");
  const to = String(formData.get("to") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const includeLink = formData.get("includeLink") !== "off";

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true, customer: true, user: true },
  });
  if (!quote || quote.userId !== user.id) return { error: "Quote not found." };
  if (!to) return { error: "Enter a recipient email address." };
  const blocked = approvalBlock(quote);
  if (blocked) return { error: blocked };

  const settings = await getSettings();
  const breakdown = computeQuoteBreakdown(quote.items, quote.discount, quote.vatRate);
  const pdfBytes = await renderQuotePdf(quote);
  const acceptUrl = includeLink ? `${getBaseUrl()}/q/${await ensurePublicToken(id)}` : null;

  const summary = breakdown.groups
    .map(
      (g) =>
        `${BILLING_LABEL[g.billing]}: <strong>${escapeHtml(formatMoney(g.total))}${BILLING_SUFFIX[g.billing]}</strong> incl. VAT`
    )
    .join("<br/>");

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
    ${message
      .split("\n")
      .map((line) => `<p style="margin:0 0 12px 0;">${escapeHtml(line) || "&nbsp;"}</p>`)
      .join("")}
    <p style="margin-top:20px;padding:14px 16px;background:#eef2ff;border-radius:10px;">
      Quote <strong>${escapeHtml(quote.number)}</strong> is attached as a PDF.<br/>${summary}
    </p>
    ${
      acceptUrl
        ? `<p style="margin:18px 0;"><a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:bold;">View &amp; accept online</a></p>`
        : ""
    }
    <p style="margin-top:20px;color:#555;">
      ${escapeHtml(quote.user.name)}<br/>${escapeHtml(settings.companyName)}
      ${quote.user.phone ? `<br/>${escapeHtml(quote.user.phone)}` : ""}
    </p>
  </div>`;

  try {
    await sendQuoteEmail({
      to,
      subject: subject || `Your quote from ${settings.companyName} (${quote.number})`,
      html,
      text: acceptUrl ? `${message}\n\nView & accept online: ${acceptUrl}` : message,
      attachment: { filename: `${quote.number}.pdf`, content: pdfBytes },
      replyTo: quote.user.email,
    });
  } catch (err: any) {
    return { error: err?.message || "Couldn't send the email." };
  }

  await prisma.quote.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  await logActivity(quote.customer.id, user.id, "QUOTE_SENT", `${quote.number} sent to ${to}`);
  if (["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_DONE"].includes(quote.customer.status)) {
    await prisma.customer.update({ where: { id: quote.customer.id }, data: { status: "QUOTE_SENT" } });
  }

  revalidatePath(`/crm/quotes/${id}`);
  revalidatePath("/crm/quotes");
  revalidatePath("/crm/customers");
  revalidatePath(`/crm/customers/${quote.customer.id}`);
  revalidatePath("/crm");
  return { success: `Quote sent to ${to}.` };
}
