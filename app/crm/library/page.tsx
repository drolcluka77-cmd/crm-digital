import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSellerMaterials } from "@/lib/seller";
import LibraryView from "./LibraryView";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requireSales();
  const [materials, customers] = await Promise.all([
    getSellerMaterials(user),
    prisma.customer.findMany({
      where: { ownerId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, email: true },
    }),
  ]);
  return <LibraryView materials={materials} customers={customers} />;
}
