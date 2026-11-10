import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/format";

export type LeadRow = Partial<
  Record<
    "name" | "company" | "email" | "phone" | "jobTitle" | "segment" | "size" | "city" | "country" | "website" | "source" | "note",
    string
  >
>;

const clip = (v: unknown, n = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, n) : null;
};

/**
 * Inserts imported leads, either owned by a seller or unassigned in a pool.
 * Skips rows without a name/company and rows whose email already exists
 * anywhere (same duplicate rule as manual entry).
 */
export async function insertLeads(
  rows: LeadRow[],
  target: { ownerId: string | null; poolId: string | null; actorId: string }
): Promise<{ created: number; skipped: string[] }> {
  const emails = rows.map((r) => (r.email || "").trim().toLowerCase()).filter(Boolean);
  const existing = await prisma.customer.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const seen = new Set(existing.map((e) => e.email));
  const skipped: string[] = [];
  let created = 0;

  for (const [i, r] of rows.entries()) {
    const name = clip(r.name) || clip(r.company);
    const label = `Row ${i + 2}`;
    if (!name) {
      skipped.push(`${label}: no name or company`);
      continue;
    }
    const email = clip(r.email)?.toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push(`${label}: invalid email "${email}"`);
      continue;
    }
    if (email && seen.has(email)) {
      skipped.push(`${label}: ${email} already exists`);
      continue;
    }
    if (email) seen.add(email);

    const c = await prisma.customer.create({
      data: {
        name,
        company: clip(r.company),
        email,
        phone: clip(r.phone, 60),
        jobTitle: clip(r.jobTitle),
        segment: clip(r.segment),
        size: clip(r.size, 80),
        city: clip(r.city, 80),
        country: clip(r.country, 80),
        website: normalizeUrl(clip(r.website)),
        source: clip(r.source, 80) || "Import",
        note: clip(r.note, 2000),
        status: "NEW",
        ownerId: target.ownerId,
        poolId: target.poolId,
      },
    });
    await prisma.activity.create({
      data: { customerId: c.id, userId: target.actorId, type: "NOTE", body: "Imported from CSV" },
    });
    created++;
  }
  return { created, skipped };
}
