"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/url";
import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { notify, supervisorsOf } from "@/lib/notify";
import { ensurePaymentLink } from "@/lib/contract-signing";
import { registerRevolutWebhook, revolutEnabled } from "@/lib/revolut";
import {
  buildContractBody,
  canSeeContract,
  contractProblems,
  newPublicToken,
  nextContractNumber,
} from "@/lib/contracts";

export type ContractResult = { error?: string; success?: string; id?: string; link?: string } | void;

const str = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max) || null;

function paths(c: { id: string; quoteId: string; customerId: string }) {
  revalidatePath(`/crm/contracts/${c.id}`);
  revalidatePath(`/admin/contracts/${c.id}`);
  revalidatePath("/crm/contracts");
  revalidatePath("/admin/contracts");
  revalidatePath(`/crm/quotes/${c.quoteId}`);
  revalidatePath(`/crm/customers/${c.customerId}`);
}

async function load(id: string) {
  const user = await requireUser();
  const c = await prisma.contract.findUnique({ where: { id }, include: { customer: true, quote: { include: { items: true } } } });
  if (!c || !(await canSeeContract(user, c))) return { user, c: null };
  return { user, c };
}

const isStaff = (role: string) => role === "ADMIN" || role === "MANAGER";

/** Quote → contract (one per quote). Client details are prefilled from the customer. */
export async function createContractFromQuote(quoteId: string): Promise<ContractResult> {
  const user = await requireUser();
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true, customer: true, contract: true } });
  if (!quote || !(await canSeeContract(user, quote))) return { error: "Quote not found." };
  if (quote.contract) return { id: quote.contract.id };
  if (quote.status === "REJECTED") return { error: "This quote was lost — reopen it first." };
  if (quote.approvalStatus === "PENDING" || quote.approvalStatus === "REJECTED") {
    return { error: "The quote's discount still needs your manager's approval." };
  }
  if (quote.items.length === 0) return { error: "The quote has no items." };

  const parties = {
    clientCompany: quote.customer.company || quote.customer.name,
    clientAddress: null,
    clientRegNo: null,
    clientVatId: null,
    clientRepresentative: quote.customer.company ? quote.customer.name : null,
  };
  // Lead finder notes carry the registration number and address.
  const note = quote.customer.note || "";
  const reg = note.match(/matična št\.\s*(\d{7,10})/i)?.[1] || null;
  const addr = note.match(/Naslov:\s*(.+)/)?.[1]?.trim() || null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const number = await nextContractNumber();
    const p = { ...parties, clientRegNo: reg, clientAddress: addr };
    try {
      const c = await prisma.contract.create({
        data: {
          number,
          quoteId: quote.id,
          customerId: quote.customerId,
          userId: quote.userId,
          ...p,
          clientEmail: quote.customer.email,
          body: await buildContractBody(number, quote, p),
        },
      });
      await logActivity(quote.customerId, user.id, "NOTE", `Contract ${number} drafted from ${quote.number}`);
      paths(c);
      return { id: c.id };
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }
  }
  return { error: "Couldn't number the contract — please try again." };
}

/** Saves client details and the text. Changing an approved contract sends it back for review. */
export async function saveContract(id: string, fd: FormData): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (c.status === "SENT" || c.status === "SIGNED" || c.status === "CANCELLED") {
    return { error: "This contract was already sent — cancel it and create a new one to change it." };
  }
  const data = {
    clientCompany: str(fd, "clientCompany", 200),
    clientAddress: str(fd, "clientAddress", 300),
    clientRegNo: str(fd, "clientRegNo", 20),
    clientVatId: str(fd, "clientVatId", 20),
    clientRepresentative: str(fd, "clientRepresentative", 200),
    clientEmail: str(fd, "clientEmail", 200)?.toLowerCase() || null,
    title: str(fd, "title", 150) || "Pogodba o naročilu storitev",
    body: String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 60000),
  };
  if (!data.body) return { error: "The contract text is empty." };
  const settings = await getSettings();
  const backToDraft = c.status === "APPROVED" && !isStaff(user.role) && settings.contractReviewRequired;
  await prisma.contract.update({
    where: { id },
    data: { ...data, ...(backToDraft ? { status: "DRAFT", reviewedAt: null, reviewedById: null } : {}) },
  });
  paths(c);
  return { success: backToDraft ? "Saved. Because it changed, it needs a new review." : "Saved." };
}

/** Rebuilds the text from the template with the current client details (discards manual edits). */
export async function regenerateContract(id: string, fd: FormData): Promise<ContractResult> {
  const saved = await saveContract(id, fd);
  if (saved?.error) return saved;
  const { c } = await load(id);
  if (!c) return { error: "Contract not found." };
  const body = await buildContractBody(c.number, c.quote, c);
  await prisma.contract.update({ where: { id }, data: { body } });
  paths(c);
  return { success: "Text rebuilt from the template." };
}

export async function submitContractForReview(id: string): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (c.status !== "DRAFT") return { error: "Only a draft can be sent for review." };
  const problems = contractProblems(c);
  if (problems.length) return { error: problems.join(" ") };
  await prisma.contract.update({ where: { id }, data: { status: "IN_REVIEW", reviewRequestedAt: new Date(), reviewNote: null } });
  await notify(await supervisorsOf(c.userId), {
    type: "CONTRACT_REVIEW",
    title: `Contract ${c.number} for ${c.clientCompany || c.customer.name} needs review`,
    body: `Sent by ${user.name}.`,
    link: `/admin/contracts/${c.id}`,
  });
  paths(c);
  return { success: "Sent for review. You'll get a notification when it's approved." };
}

/** Manager/admin approves or sends it back with a note. */
export async function reviewContract(id: string, approve: boolean, note: string): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (!isStaff(user.role)) return { error: "Only a manager or admin can review contracts." };
  if (c.status !== "IN_REVIEW" && c.status !== "DRAFT") return { error: "This contract isn't waiting for review." };
  if (approve) {
    const problems = contractProblems(c);
    if (problems.length) return { error: problems.join(" ") };
  }
  await prisma.contract.update({
    where: { id },
    data: approve
      ? { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date(), reviewNote: note.trim().slice(0, 1000) || null }
      : { status: "DRAFT", reviewNote: note.trim().slice(0, 1000) || "Please revise.", reviewedById: user.id, reviewedAt: null },
  });
  if (c.userId !== user.id) {
    await notify([c.userId], {
      type: "CONTRACT_REVIEWED",
      title: approve ? `✅ Contract ${c.number} approved — you can send it` : `Contract ${c.number} needs changes`,
      body: note.trim() || null,
      link: `/crm/contracts/${c.id}`,
    });
  }
  paths(c);
  return { success: approve ? "Approved." : "Sent back to the seller." };
}

/** E-mails the signing link to the client. */
export async function sendContract(id: string): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  const settings = await getSettings();
  const mayDirect = isStaff(user.role) || !settings.contractReviewRequired;
  if (!(c.status === "APPROVED" || c.status === "SENT" || (c.status === "DRAFT" && mayDirect) || (c.status === "IN_REVIEW" && isStaff(user.role)))) {
    return { error: c.status === "SIGNED" ? "Already signed." : "The contract has to be approved before it's sent." };
  }
  const problems = contractProblems(c);
  if (problems.length) return { error: problems.join(" ") };

  const token = c.publicToken || newPublicToken();
  const link = `${getBaseUrl()}/c/${token}`;
  const seller = await prisma.user.findUnique({ where: { id: c.userId } });
  const greeting = c.clientRepresentative ? `Pozdravljeni,` : "Pozdravljeni,";
  const text = `${greeting}

v podpis vam pošiljamo pogodbo ${c.number} (${c.title}).

Pogodbo preberete in podpišete tukaj:
${link}

Podpis je elektronski: ob podpisu vam na ta e-naslov pošljemo 6-mestno kodo za potrditev. Po podpisu takoj prejmete podpisano pogodbo in predračun.

Za vprašanja sem vam na voljo${seller?.phone ? ` na ${seller.phone}` : ""} ali z odgovorom na to sporočilo.

Lep pozdrav,
${seller?.name || settings.legalName}
${settings.legalName}`;
  try {
    await sendEmail({
      to: c.clientEmail!,
      subject: `Pogodba ${c.number} v podpis — ${settings.legalName}`,
      text,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2430">${escapeHtml(text)
        .replace(link, `<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Odpri in podpiši pogodbo</a>`)
        .replace(/\n/g, "<br>")}</div>`,
      replyTo: seller?.email,
    });
  } catch (e: any) {
    return { error: `The e-mail couldn't be sent: ${e?.message || e}` };
  }
  await prisma.contract.update({
    where: { id },
    data: {
      publicToken: token,
      status: "SENT",
      sentAt: new Date(),
      ...(c.status !== "APPROVED" && !c.reviewedAt ? { reviewedById: user.id, reviewedAt: new Date() } : {}),
    },
  });
  await logActivity(c.customerId, user.id, "CONTRACT_SENT", `Contract ${c.number} sent for signature to ${c.clientEmail}`);
  paths(c);
  return { success: `Sent to ${c.clientEmail}.`, link };
}

export async function cancelContract(id: string): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (c.status === "SIGNED") return { error: "A signed contract can't be cancelled here — end it with the notice period." };
  await prisma.contract.update({ where: { id }, data: { status: "CANCELLED", publicToken: null } });
  await logActivity(c.customerId, user.id, "NOTE", `Contract ${c.number} cancelled`);
  paths(c);
  return { success: "Cancelled." };
}

/** Deletes a cancelled or draft contract so a new one can be made from the quote. */
export async function deleteContract(id: string): Promise<ContractResult> {
  const { c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (c.status !== "CANCELLED" && c.status !== "DRAFT") return { error: "Cancel it first." };
  await prisma.contract.delete({ where: { id } });
  paths(c);
  return { success: "Deleted." };
}

/** Admin/manager confirms the proforma was paid (bank transfer). */
export async function markContractPaid(id: string, paid: boolean): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (!isStaff(user.role)) return { error: "Only a manager or admin can confirm payments." };
  if (c.status !== "SIGNED") return { error: "The contract isn't signed yet." };
  await prisma.contract.update({ where: { id }, data: { paidAt: paid ? new Date() : null } });
  if (paid) {
    await logActivity(c.customerId, user.id, "PAYMENT", `Proforma ${c.proformaNumber} paid`);
    await notify([c.userId], {
      type: "PAYOUT",
      title: `💶 ${c.clientCompany || c.customer.name} paid proforma ${c.proformaNumber}`,
      link: `/crm/contracts/${c.id}`,
    });
  }
  paths(c);
  return { success: paid ? "Marked as paid. Record the payment under Payments for commission." : "Marked as unpaid." };
}

/** Contract settings (admin): company data, template, review rule. */
export async function saveContractSettings(fd: FormData): Promise<ContractResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only an admin can change contract settings." };
  const template = String(fd.get("contractTemplate") ?? "").replace(/\r\n/g, "\n").trim();
  const templatePicked = String(fd.get("contractTemplatePicked") ?? "").replace(/\r\n/g, "\n").trim();
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      legalName: str(fd, "legalName", 200) || "AURELIA GROUP d.o.o.",
      legalAddress: str(fd, "legalAddress"),
      legalRegNo: str(fd, "legalRegNo", 20),
      legalTaxNo: str(fd, "legalTaxNo", 20),
      legalVatId: str(fd, "legalVatId", 20),
      legalVatPayer: fd.get("legalVatPayer") === "on",
      legalIban: str(fd, "legalIban", 40),
      legalBic: str(fd, "legalBic", 20),
      legalBank: str(fd, "legalBank", 100),
      legalRepresentative: str(fd, "legalRepresentative", 200),
      legalEmail: str(fd, "legalEmail", 200),
      contractReviewRequired: fd.get("contractReviewRequired") === "on",
      proformaDueDays: Math.max(1, Math.min(60, Math.round(Number(fd.get("proformaDueDays")) || 8))),
      contractTemplate: template && fd.get("useDefaultTemplate") !== "on" ? template : null,
      contractTemplatePicked: templatePicked && fd.get("useDefaultPicked") !== "on" ? templatePicked : null,
    },
  });
  revalidatePath("/admin/contracts");
  return { success: "Saved. New contracts use these details; open drafts can be rebuilt with “Rebuild text”." };
}

/** Admin: creates (or shows) the Revolut payment link for a signed contract. */
export async function createPaymentLink(id: string): Promise<ContractResult> {
  const { user, c } = await load(id);
  if (!c) return { error: "Contract not found." };
  if (!isStaff(user.role) && c.userId !== user.id) return { error: "Not allowed." };
  if (!revolutEnabled()) return { error: "Revolut isn't connected (REVOLUT_API_KEY is not set)." };
  if (c.status !== "SIGNED") return { error: "The contract isn't signed yet." };
  try {
    const link = await ensurePaymentLink(c.id, getBaseUrl());
    paths(c);
    return link ? { success: `Payment link: ${link}`, link } : { error: "Nothing to pay." };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

/** Admin: registers the webhook so paid proformas are marked automatically. */
export async function connectRevolutWebhook(): Promise<ContractResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only an admin can do this." };
  if (!revolutEnabled()) return { error: "Add REVOLUT_API_KEY on Railway first." };
  try {
    const url = `${getBaseUrl()}/api/webhooks/revolut`;
    const w = await registerRevolutWebhook(url);
    await prisma.settings.update({ where: { id: 1 }, data: { revolutWebhookId: w.id, revolutWebhookSecret: w.secret } });
    revalidatePath("/admin/contracts");
    return { success: `Webhook connected: ${url}` };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}
