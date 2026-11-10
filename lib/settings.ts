import { prisma } from "@/lib/prisma";

/**
 * Settings is a single-row table (id is always 1). This helper fetches
 * it, creating a default row the first time it's called so the rest of
 * the app never has to deal with a missing-settings case.
 */
export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  return prisma.settings.create({
    data: {
      id: 1,
      companyName: "AURELIA DISTRIBUCIJA d.o.o.",
      vatRate: 22,
    },
  });
}
