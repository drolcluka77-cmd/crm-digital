import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { loadAdminMaterials } from "@/lib/materials";
import MaterialsManager from "../../materials/MaterialsManager";
import ProductHeader from "./ProductHeader";
import ProductDetailsForm from "./ProductDetailsForm";
import PlansManager from "./PlansManager";
import ProductSellers from "./ProductSellers";
import TrainingManager from "./TrainingManager";
import TemplatesManager from "../../templates/TemplatesManager";
import { loadAdminTemplates } from "@/lib/admin-templates";

export const dynamic = "force-dynamic";

export default async function ProductEditorPage({ params }: { params: { id: string } }) {
  await requireAdmin();

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      plans: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
      access: { select: { userId: true } },
    },
  });
  if (!product) notFound();

  const [materials, sellers, families, quoteLines, templates, questions, certs] = await Promise.all([
    loadAdminMaterials({ productId: product.id }),
    prisma.user.findMany({
      where: { role: "SALES" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, active: true, manager: { select: { name: true } } },
    }),
    prisma.product.findMany({ where: { family: { not: null } }, select: { family: true }, distinct: ["family"] }),
    prisma.quoteItem.count({ where: { productId: product.id } }),
    loadAdminTemplates(product.id),
    prisma.quizQuestion.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } }),
    prisma.certification.findMany({
      where: { productId: product.id },
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-black/40 hover:text-black/60">
        ← All products
      </Link>

      <ProductHeader
        product={{
          id: product.id,
          name: product.name,
          family: product.family,
          active: product.active,
          color: product.color,
          imageUrl: product.imageUrl,
        }}
        quoteLines={quoteLines}
      />

      <nav className="flex flex-wrap gap-2 mb-6 text-sm">
        {[
          ["#details", "Details & playbook"],
          ["#plans", `Plans & pricing (${product.plans.length})`],
          ["#materials", `Materials (${materials.length})`],
          ["#templates", `Email templates (${templates.length})`],
          ["#training", `Training (${questions.length})`],
          ["#sellers", `Sellers (${product.access.length})`],
        ].map(([href, label]) => (
          <a key={href} href={href} className="chip">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        <section id="details" className="scroll-mt-6">
          <ProductDetailsForm
            families={families.map((f) => f.family!).filter(Boolean)}
            product={{
              id: product.id,
              name: product.name,
              family: product.family,
              tagline: product.tagline,
              targetSegment: product.targetSegment,
              description: product.description,
              pitch: product.pitch,
              keyBenefits: product.keyBenefits,
              idealCustomer: product.idealCustomer,
              objections: product.objections,
              websiteUrl: product.websiteUrl,
              demoUrl: product.demoUrl,
              imageUrl: product.imageUrl,
              color: product.color,
              commissionRate: product.commissionRate,
              renewalCommissionRate: product.renewalCommissionRate,
              maxDiscount: product.maxDiscount,
              sortOrder: product.sortOrder,
            }}
          />
        </section>

        <section id="plans" className="scroll-mt-6">
          <PlansManager
            productId={product.id}
            plans={product.plans.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              billing: p.billing,
              unitLabel: p.unitLabel,
              description: p.description,
              active: p.active,
              sortOrder: p.sortOrder,
            }))}
          />
        </section>

        <section id="materials" className="scroll-mt-6">
          <MaterialsManager
            materials={materials}
            products={[{ id: product.id, name: product.name }]}
            fixedProductId={product.id}
            compact
          />
        </section>

        <section id="templates" className="scroll-mt-6">
          <TemplatesManager
            templates={templates}
            products={[{ id: product.id, name: product.name }]}
            fixedProductId={product.id}
            compact
          />
        </section>

        <section id="training" className="scroll-mt-6">
          <TrainingManager
            productId={product.id}
            requireCertification={product.requireCertification}
            passScore={product.passScore}
            questions={questions.map((q) => ({
              id: q.id,
              question: q.question,
              options: safeOptions(q.options),
              correctIndex: q.correctIndex,
              explanation: q.explanation,
            }))}
            certified={certs.map((c) => ({
              name: c.user.name,
              score: c.bestScore,
              passedAt: c.passedAt?.toISOString() ?? null,
            }))}
          />
        </section>

        <section id="sellers" className="scroll-mt-6">
          <ProductSellers
            productId={product.id}
            productActive={product.active}
            sellers={sellers.map((s) => ({
              id: s.id,
              name: s.name,
              email: s.email,
              active: s.active,
              managerName: s.manager?.name ?? null,
            }))}
            initialSelected={product.access.map((a) => a.userId)}
          />
        </section>
      </div>
    </div>
  );
}

function safeOptions(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
