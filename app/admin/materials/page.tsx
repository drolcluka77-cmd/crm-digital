import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { loadAdminMaterials } from "@/lib/materials";
import MaterialsManager from "./MaterialsManager";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  await requireAdmin();
  const [materials, products] = await Promise.all([
    loadAdminMaterials(),
    prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return <MaterialsManager materials={materials} products={products} />;
}
