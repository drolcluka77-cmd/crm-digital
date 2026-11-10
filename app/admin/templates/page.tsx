import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import TemplatesManager from "./TemplatesManager";
import { loadAdminTemplates } from "@/lib/admin-templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireAdmin();
  const [templates, products] = await Promise.all([
    loadAdminTemplates(),
    prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return <TemplatesManager templates={templates} products={products} />;
}
