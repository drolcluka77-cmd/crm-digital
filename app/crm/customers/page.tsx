import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSellerProducts } from "@/lib/seller";
import CustomersManager from "./CustomersManager";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { stage?: string; product?: string; due?: string };
}) {
  const user = await requireSales();

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        interests: { include: { product: { select: { id: true, name: true, color: true } } } },
        _count: { select: { quotes: true } },
      },
    }),
    getSellerProducts(user),
  ]);

  const data = customers.map((c) => ({
    id: c.id,
    name: c.name,
    jobTitle: c.jobTitle,
    company: c.company,
    segment: c.segment,
    email: c.email,
    phone: c.phone,
    city: c.city,
    status: c.status,
    estimatedValue: c.estimatedValue,
    nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
    lastContactAt: c.lastContactAt?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
    quoteCount: c._count.quotes,
    products: c.interests.map((i) => ({ id: i.product.id, name: i.product.name, color: i.product.color })),
  }));

  return (
    <CustomersManager
      customers={data}
      products={products.map((p) => ({ id: p.id, name: p.name }))}
      initialStage={searchParams.stage}
      initialProduct={searchParams.product}
      initialDue={searchParams.due === "1"}
    />
  );
}
