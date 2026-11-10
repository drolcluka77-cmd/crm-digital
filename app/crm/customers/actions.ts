"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSales, type CurrentUser } from "@/lib/session";
import { sendEmail, type MailAttachment } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import { getAccessibleProductIds, getSellableProductIds, canAccessMaterial } from "@/lib/access";
import { fillTemplate } from "@/lib/templates";
import { insertLeads, type LeadRow } from "@/lib/leads";
import { logActivity } from "@/lib/activity";
import { readPrivateFile } from "@/lib/upload";
import { getBaseUrl } from "@/lib/url";
import { escapeHtml, normalizeUrl } from "@/lib/format";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  MANUAL_ACTIVITY_TYPES,
  MATERIAL_TYPE_LABEL,
} from "@/lib/constants";

export type ActionResult = { error?: string; success?: string; id?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const opt = (fd: FormData, key: string) => str(fd, key) || null;

/** Attachments above this go as links only (most mail servers cap at ~20–25 MB). */
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;
const SHARE_LINK_DAYS = 90;

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(`${raw}T09:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateCustomer(id?: string) {
  revalidatePath("/crm/customers");
  revalidatePath("/crm");
  if (id) revalidatePath(`/crm/customers/${id}`);
}

async function ownCustomer(user: CurrentUser, id: string) {
  const c = await prisma.customer.findUnique({ where: { id } });
  return c && c.ownerId === user.id ? c : null;
}

/** Channel-conflict rule: one contact email belongs to one seller. */
async function duplicateOwner(email: string | null, excludeId?: string) {
  if (!email) return null;
  const clash = await prisma.customer.findFirst({
    where: { email, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!clash) return null;
  return clash.owner ?? { id: "__pool__", name: "a lead pool (unassigned)" };
}

async function readCustomerFields(user: CurrentUser, fd: FormData) {
  const name = str(fd, "name");
  if (!name) return { error: "Contact name is required." } as const;
  const status = str(fd, "status") || "NEW";
  const estimatedRaw = str(fd, "estimatedValue");
  const estimatedValue = estimatedRaw ? Number(estimatedRaw) : null;
  if (estimatedValue !== null && (Number.isNaN(estimatedValue) || estimatedValue < 0)) {
    return { error: "Estimated value must be a positive number." } as const;
  }
  const accessible = await getAccessibleProductIds(user);
  const productIds = fd
    .getAll("productIds")
    .map(String)
    .filter((id) => accessible.includes(id));

  return {
    data: {
      name,
      jobTitle: opt(fd, "jobTitle"),
      company: opt(fd, "company"),
      segment: opt(fd, "segment"),
      email: str(fd, "email").toLowerCase() || null,
      phone: opt(fd, "phone"),
      website: normalizeUrl(str(fd, "website")),
      city: opt(fd, "city"),
      country: opt(fd, "country"),
      size: opt(fd, "size"),
      source: opt(fd, "source"),
      note: opt(fd, "note"),
      status: (LEAD_STATUSES as readonly string[]).includes(status) ? status : "NEW",
      estimatedValue,
      nextFollowUpAt: parseDate(str(fd, "nextFollowUpAt")),
    },
    productIds,
  } as const;
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const parsed = await readCustomerFields(user, formData);
  if ("error" in parsed) return { error: parsed.error };

  const dup = await duplicateOwner(parsed.data.email);
  if (dup) {
    return {
      error:
        dup.id === user.id
          ? "You already have a customer with this email."
          : `This contact is already registered by ${dup.name}. Ask your manager if it should be reassigned.`,
    };
  }

  const customer = await prisma.customer.create({
    data: {
      ...parsed.data,
      ownerId: user.id,
      interests: { create: parsed.productIds.map((productId) => ({ productId })) },
    },
  });
  await logActivity(customer.id, user.id, "NOTE", "Lead created");

  revalidateCustomer();
  if (formData.get("open") === "1") redirect(`/crm/customers/${customer.id}`);
  return { success: "Customer added.", id: customer.id };
}

export async function updateCustomer(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const id = str(formData, "id");
  const existing = await ownCustomer(user, id);
  if (!existing) return { error: "Customer not found." };

  const parsed = await readCustomerFields(user, formData);
  if ("error" in parsed) return { error: parsed.error };

  const dup = await duplicateOwner(parsed.data.email, id);
  if (dup) {
    return { error: `Another lead with this email exists (owned by ${dup.id === user.id ? "you" : dup.name}).` };
  }

  // Keep interests in products the seller can no longer see; replace the rest.
  const accessible = await getAccessibleProductIds(user);
  await prisma.$transaction([
    prisma.customerProduct.deleteMany({ where: { customerId: id, productId: { in: accessible } } }),
    prisma.customer.update({
      where: { id },
      data: {
        ...parsed.data,
        interests: { create: parsed.productIds.map((productId) => ({ productId })) },
      },
    }),
  ]);
  if (existing.status !== parsed.data.status) {
    await logActivity(
      id,
      user.id,
      "STATUS_CHANGE",
      `${LEAD_STATUS_LABEL[existing.status] || existing.status} → ${LEAD_STATUS_LABEL[parsed.data.status]}`
    );
  }
  revalidateCustomer(id);
  return { success: "Saved." };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const user = await requireSales();
  if (!(await ownCustomer(user, id))) return { error: "Customer not found." };
  const quoteCount = await prisma.quote.count({ where: { customerId: id } });
  if (quoteCount > 0) return { error: "This customer has quotes on file — delete those first, or mark the lead as Lost." };
  await prisma.customer.delete({ where: { id } });
  revalidateCustomer();
  redirect("/crm/customers");
}

/** One-click status / follow-up changes from the customer page. */
export async function quickUpdateCustomer(
  id: string,
  patch: { status?: string; nextFollowUpAt?: string | null }
): Promise<ActionResult> {
  const user = await requireSales();
  const existing = await ownCustomer(user, id);
  if (!existing) return { error: "Customer not found." };

  const data: { status?: string; nextFollowUpAt?: Date | null } = {};
  if (patch.status && (LEAD_STATUSES as readonly string[]).includes(patch.status)) data.status = patch.status;
  if (patch.nextFollowUpAt !== undefined) data.nextFollowUpAt = parseDate(patch.nextFollowUpAt || "");

  await prisma.customer.update({ where: { id }, data });
  if (data.status && data.status !== existing.status) {
    await logActivity(
      id,
      user.id,
      "STATUS_CHANGE",
      `${LEAD_STATUS_LABEL[existing.status] || existing.status} → ${LEAD_STATUS_LABEL[data.status]}`
    );
  }
  revalidateCustomer(id);
}

/** Log a call / meeting / demo / note, optionally setting the next follow-up and status. */
export async function addActivity(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const customerId = str(formData, "customerId");
  const existing = await ownCustomer(user, customerId);
  if (!existing) return { error: "Customer not found." };

  const type = str(formData, "type") || "NOTE";
  const body = str(formData, "body");
  if (!(MANUAL_ACTIVITY_TYPES as readonly string[]).includes(type)) return { error: "Pick an activity type." };
  if (!body) return { error: "Write what happened." };

  await logActivity(customerId, user.id, type, body);

  const data: { nextFollowUpAt?: Date | null; status?: string } = {};
  const follow = str(formData, "nextFollowUpAt");
  if (follow) data.nextFollowUpAt = parseDate(follow);
  else if (formData.get("clearFollowUp") === "on") data.nextFollowUpAt = null;
  const status = str(formData, "status");
  if (status && status !== existing.status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    data.status = status;
  }
  if (Object.keys(data).length) {
    await prisma.customer.update({ where: { id: customerId }, data });
    if (data.status) {
      await logActivity(
        customerId,
        user.id,
        "STATUS_CHANGE",
        `${LEAD_STATUS_LABEL[existing.status] || existing.status} → ${LEAD_STATUS_LABEL[data.status]}`
      );
    }
  }
  revalidateCustomer(customerId);
  return { success: "Logged." };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const user = await requireSales();
  const a = await prisma.activity.findUnique({ where: { id }, include: { customer: true } });
  if (!a || a.customer.ownerId !== user.id || a.userId !== user.id) return { error: "Not found." };
  if (!(MANUAL_ACTIVITY_TYPES as readonly string[]).includes(a.type)) {
    return { error: "Automatic entries can't be deleted." };
  }
  await prisma.activity.delete({ where: { id } });
  revalidateCustomer(a.customerId);
}

function emailHtml(message: string, extraHtml: string, signature: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
    ${message
      .split("\n")
      .map((line) => `<p style="margin:0 0 12px 0;">${linkify(escapeHtml(line)) || "&nbsp;"}</p>`)
      .join("")}
    ${extraHtml}
    <p style="margin-top:24px;color:#555;">${signature}</p>
  </div>`;
}

/** Makes plain https:// links in a seller's message clickable. */
function linkify(escaped: string) {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#4338ca;">${url}</a>`);
}

/** Tracked link to the seller's booking page for this customer (/b/<token>). */
async function bookingLinkFor(customerId: string): Promise<string> {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { bookingToken: true } });
  let token = c?.bookingToken;
  if (!token) {
    token = randomBytes(12).toString("base64url");
    await prisma.customer.update({ where: { id: customerId }, data: { bookingToken: token } });
  }
  return `${getBaseUrl()}/b/${token}`;
}

function signatureFor(user: CurrentUser, companyName: string) {
  return `${escapeHtml(user.name)}<br/>${escapeHtml(companyName)}${user.phone ? `<br/>${escapeHtml(user.phone)}` : ""}`;
}

export async function sendIntroEmail(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const customerId = str(formData, "customerId");
  const subject = str(formData, "subject");
  const message = str(formData, "message");

  const customer = await ownCustomer(user, customerId);
  if (!customer) return { error: "Customer not found." };
  if (!customer.email) return { error: "This customer doesn't have an email address on file." };
  if (!subject || !message) return { error: "Write a subject and message." };

  // {{bookingLink}} → tracked link to the seller's booking page.
  let finalMessage = message;
  let finalSubject = subject;
  if (/\{\{\s*bookingLink\s*\}\}/.test(message + subject)) {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { bookingUrl: true } });
    if (!me?.bookingUrl) {
      return { error: "Add your booking link (Calendly, Cal.com …) under Account first, or remove {{bookingLink}}." };
    }
    const link = await bookingLinkFor(customerId);
    finalMessage = fillTemplate(message, { bookingLink: link });
    finalSubject = fillTemplate(subject, { bookingLink: link });
  }
  if (/\{\{\s*\w+\s*\}\}/.test(finalMessage + finalSubject)) {
    return { error: "Some {{placeholders}} are still empty — fill them in before sending." };
  }

  const settings = await getSettings();
  try {
    await sendEmail({
      to: customer.email,
      subject: finalSubject,
      html: emailHtml(finalMessage, "", signatureFor(user, settings.companyName)),
      text: finalMessage,
      replyTo: user.email,
    });
  } catch (err: any) {
    return { error: err?.message || "Couldn't send the email." };
  }

  await logActivity(customerId, user.id, "EMAIL", `“${finalSubject}”`);
  if (customer.status === "NEW") {
    await prisma.customer.update({ where: { id: customerId }, data: { status: "CONTACTED" } });
  }
  revalidateCustomer(customerId);
  return { success: "Email sent." };
}

/**
 * Emails chosen materials to a client. Each material becomes a tracked link
 * (/s/<token>) so the seller sees when it's opened; small files can also be
 * attached directly.
 */
export async function sendMaterials(formData: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const customerId = str(formData, "customerId");
  const to = str(formData, "to");
  const subject = str(formData, "subject");
  const message = str(formData, "message");
  const attachFiles = formData.get("attachFiles") === "on";
  const materialIds = Array.from(new Set(formData.getAll("materialIds").map(String))).filter(Boolean);

  const customer = await ownCustomer(user, customerId);
  if (!customer) return { error: "Choose one of your customers." };
  if (!to) return { error: "Enter the recipient's email." };
  if (!subject || !message) return { error: "Write a subject and message." };
  if (materialIds.length === 0) return { error: "Choose at least one material to send." };

  const materials = await prisma.salesMaterial.findMany({ where: { id: { in: materialIds } } });
  for (const m of materials) {
    if (m.internalOnly) return { error: `“${m.title}” is internal only and can't be sent to clients.` };
    if (!(await canAccessMaterial(user, m))) return { error: "You don't have access to one of these materials." };
  }
  const sellable = await getSellableProductIds(user);
  const locked = materials.find((m) => m.productId && !sellable.includes(m.productId));
  if (locked) return { error: `Pass the product quiz before sending “${locked.title}” to clients.` };
  if (materials.length === 0) return { error: "Those materials no longer exist." };

  const baseUrl = getBaseUrl();
  const expiresAt = new Date(Date.now() + SHARE_LINK_DAYS * 86_400_000);
  const shares = await Promise.all(
    materials.map((m) =>
      prisma.materialShare.create({
        data: {
          token: randomBytes(16).toString("base64url"),
          materialId: m.id,
          customerId,
          userId: user.id,
          expiresAt,
        },
      })
    )
  );

  const attachments: MailAttachment[] = [];
  let attachedBytes = 0;
  if (attachFiles) {
    for (const m of materials) {
      if (!m.storagePath || !m.fileSize) continue;
      if (attachedBytes + m.fileSize > MAX_ATTACH_BYTES) continue; // stays a link
      try {
        attachments.push({
          filename: m.fileName || m.title,
          content: await readPrivateFile(m.storagePath),
          contentType: m.fileType || undefined,
        });
        attachedBytes += m.fileSize;
      } catch {
        // missing file → link only
      }
    }
  }

  const linksHtml = `<div style="margin-top:18px;padding:14px 16px;background:#eef2ff;border-radius:10px;">
    ${materials
      .map((m) => {
        const share = shares.find((s) => s.materialId === m.id)!;
        return `<p style="margin:0 0 8px 0;"><a href="${baseUrl}/s/${share.token}" style="color:#4338ca;font-weight:bold;text-decoration:none;">${escapeHtml(
          m.title
        )} →</a><br/><span style="color:#64748b;font-size:12px;">${escapeHtml(
          MATERIAL_TYPE_LABEL[m.type] || ""
        )}</span></p>`;
      })
      .join("")}
  </div>`;
  const linksText = materials
    .map((m) => `${m.title}: ${baseUrl}/s/${shares.find((s) => s.materialId === m.id)!.token}`)
    .join("\n");

  const settings = await getSettings();
  try {
    await sendEmail({
      to,
      subject,
      html: emailHtml(message, linksHtml, signatureFor(user, settings.companyName)),
      text: `${message}\n\n${linksText}`,
      replyTo: user.email,
      attachments,
    });
  } catch (err: any) {
    await prisma.materialShare.deleteMany({ where: { id: { in: shares.map((s) => s.id) } } });
    return { error: err?.message || "Couldn't send the email." };
  }

  await logActivity(customerId, user.id, "MATERIALS_SENT", materials.map((m) => m.title).join(", "));
  if (customer.status === "NEW") {
    await prisma.customer.update({ where: { id: customerId }, data: { status: "CONTACTED" } });
  }
  revalidateCustomer(customerId);
  return { success: `Sent ${materials.length} item${materials.length === 1 ? "" : "s"} to ${to}.` };
}

/** Book a demo date/time on a lead: stage → Demo scheduled, follow-up on that day. */
export async function scheduleDemo(customerId: string, when: string, note: string): Promise<ActionResult> {
  const user = await requireSales();
  const customer = await ownCustomer(user, customerId);
  if (!customer) return { error: "Customer not found." };
  const at = new Date(when);
  if (!when || Number.isNaN(at.getTime())) return { error: "Pick a date and time." };

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      demoAt: at,
      nextFollowUpAt: at,
      status: ["NEW", "CONTACTED"].includes(customer.status) ? "DEMO_SCHEDULED" : customer.status,
    },
  });
  const label = at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  await logActivity(customerId, user.id, "DEMO_BOOKED", `Demo scheduled for ${label}${note.trim() ? ` — ${note.trim()}` : ""}`);
  revalidateCustomer(customerId);
  return { success: `Demo scheduled for ${label}.` };
}

export async function clearDemo(customerId: string): Promise<ActionResult> {
  const user = await requireSales();
  if (!(await ownCustomer(user, customerId))) return { error: "Customer not found." };
  await prisma.customer.update({ where: { id: customerId }, data: { demoAt: null } });
  revalidateCustomer(customerId);
}

/** CSV import into the seller's own customer list. */
export async function importMyLeads(rows: LeadRow[]): Promise<{ error?: string; created?: number; skipped?: string[] }> {
  const user = await requireSales();
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 2000) return { error: "Import at most 2,000 rows at a time." };
  const result = await insertLeads(rows, { ownerId: user.id, poolId: null, actorId: user.id });
  revalidateCustomer();
  return result;
}
