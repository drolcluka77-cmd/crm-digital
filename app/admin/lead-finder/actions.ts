"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { canManageSeller } from "@/lib/access";
import { importFromAjpes, loadRules, matchProduct, ImportSummary } from "@/lib/prospects";

export type ActionResult = { error?: string; success?: string; summary?: ImportSummary } | void;

const PATH = "/admin/lead-finder";

export async function runImport(): Promise<ActionResult> {
  await requireStaff();
  if ((await prisma.prospectRule.count({ where: { active: true } })) === 0) {
    return { error: "Add at least one active rule first." };
  }
  try {
    const summary = await importFromAjpes();
    revalidatePath(PATH);
    return {
      success: `${summary.created} new leads added, ${summary.duplicates} duplicates skipped (${summary.matched} matched out of ${summary.fetched} companies searched).${
        summary.errors.length ? ` ${summary.errors.length} searches failed: ${summary.errors.slice(0, 3).join("; ")}` : ""
      }`,
      summary,
    };
  } catch (e: any) {
    return { error: `Import failed: ${e?.message || e}` };
  }
}

function int(v: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export async function saveFinderSettings(fd: FormData): Promise<ActionResult> {
  await requireStaff();
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      prospectDailyPerSeller: int(fd.get("daily"), 0, 100, 5),
      prospectExpiryDays: int(fd.get("expiry"), 1, 60, 3),
      prospectLookupDailyCap: int(fd.get("lookupCap"), 0, 5000, 100),
      prospectAutoImport: fd.get("autoImport") === "on",
    },
  });
  revalidatePath(PATH);
  return { success: "Settings saved." };
}

export async function saveRule(fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = String(fd.get("id") || "");
  const productId = String(fd.get("productId") || "");
  const keywords = String(fd.get("keywords") || "").trim();
  if (!productId || !keywords) return { error: "Choose a product and add at least one keyword." };
  const data = {
    productId,
    keywords,
    exclude: String(fd.get("exclude") || "").trim() || null,
    priority: int(fd.get("priority"), -10, 10, 0),
    active: fd.get("active") === "on",
  };
  if (id) await prisma.prospectRule.update({ where: { id }, data });
  else await prisma.prospectRule.create({ data });
  revalidatePath(PATH);
  return { success: "Rule saved. Run an import to find companies with the new keywords." };
}

export async function deleteRule(id: string): Promise<ActionResult> {
  await requireStaff();
  await prisma.prospectRule.delete({ where: { id } });
  revalidatePath(PATH);
  return { success: "Rule deleted." };
}

/** Re-applies the rules to leads nobody has seen yet (after changing keywords). */
export async function rematchAvailable(): Promise<ActionResult> {
  await requireStaff();
  const rules = await loadRules();
  const rows = await prisma.prospect.findMany({ where: { status: "NEW" }, select: { id: true, name: true, productId: true } });
  let changed = 0;
  let unmatched = 0;
  for (const r of rows) {
    const m = matchProduct(r.name, rules);
    if (!m) {
      await prisma.prospect.update({ where: { id: r.id }, data: { status: "REJECTED", rejectReason: "No longer matches any rule" } });
      unmatched++;
    } else if (m.productId !== r.productId) {
      await prisma.prospect.update({ where: { id: r.id }, data: { productId: m.productId, matchedKeyword: m.keyword, score: m.score } });
      changed++;
    }
  }
  revalidatePath(PATH);
  return { success: `${changed} leads moved to another product, ${unmatched} no longer match and were set aside.` };
}

export async function setSellerQuota(userId: string, value: string): Promise<ActionResult> {
  const user = await requireStaff();
  if (!(await canManageSeller(user, userId))) return { error: "You can't change this seller." };
  const v = value.trim();
  await prisma.user.update({
    where: { id: userId },
    data: { prospectQuota: v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v)) || 0)) },
  });
  revalidatePath(PATH);
  return { success: "Saved." };
}

export async function setProspectStatus(id: string, status: "NEW" | "DO_NOT_CONTACT" | "REJECTED"): Promise<ActionResult> {
  await requireStaff();
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return { error: "Not found." };
  if (p.status === "CLAIMED") return { error: "Already a customer — change it on the customer page." };
  await prisma.prospect.update({
    where: { id },
    data: { status, recommendedToId: null, recommendedAt: null, ...(status === "NEW" ? { rejectReason: null } : {}) },
  });
  revalidatePath(PATH);
  return { success: "Updated." };
}
