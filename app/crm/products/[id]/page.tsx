import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { canAccessProduct, getSellableProductIds } from "@/lib/access";
import { getSellerMaterials } from "@/lib/seller";
import Badge from "@/components/Badge";
import { CheckCircleIcon, DownloadIcon, EyeIcon } from "@/components/icons";
import MaterialIcon from "@/components/MaterialIcon";
import { formatFileSize, formatPrice, materialHref } from "@/lib/format";
import { LEAD_STATUS_LABEL, MATERIAL_TYPE_LABEL } from "@/lib/constants";
import ProductActions from "./ProductActions";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

const lines = (v: string | null) => (v || "").split("\n").map((l) => l.trim()).filter(Boolean);

export default async function ProductPlaybookPage({ params }: { params: { id: string } }) {
  const user = await requireSales();
  if (!(await canAccessProduct(user, params.id))) notFound();

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { plans: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] } },
  });
  if (!product || !product.active) notFound();

  const [materials, leads, customers, sellable, questionCount, cert] = await Promise.all([
    getSellerMaterials(user, { productId: product.id }),
    prisma.customer.findMany({
      where: { ownerId: user.id, interests: { some: { productId: product.id } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, company: true, status: true },
    }),
    prisma.customer.findMany({
      where: { ownerId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, email: true },
    }),
    getSellableProductIds(user),
    prisma.quizQuestion.count({ where: { productId: product.id } }),
    prisma.certification.findUnique({
      where: { userId_productId: { userId: user.id, productId: product.id } },
    }),
  ]);
  const canSell = sellable.includes(product.id);

  const benefits = lines(product.keyBenefits);
  const icp = lines(product.idealCustomer);
  const objections = lines(product.objections).map((l) => {
    const [q, ...rest] = l.split(/\s+[—–-]\s+/);
    return { q, a: rest.join(" — ") };
  });
  const accent = product.color || "#4f46e5";

  return (
    <div>
      <Link href="/crm/products" className="text-sm text-black/40 hover:text-black/60">
        ← My products
      </Link>

      <div className="card overflow-hidden mt-3 mb-6">
        <div className="h-2" style={{ background: accent }} />
        <div className="p-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            {product.family && <div className="section-title mb-1">{product.family}</div>}
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            {product.tagline && <p className="text-black/60 mt-1">{product.tagline}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {product.targetSegment && <Badge variant="INFO">For: {product.targetSegment}</Badge>}
              {product.commissionRate > 0 && (
                <Badge variant="WON">You earn {product.commissionRate}% of first-year value</Badge>
              )}
            </div>
          </div>
          <ProductActions
            productId={product.id}
            demoUrl={product.demoUrl}
            websiteUrl={product.websiteUrl}
            materials={materials}
            customers={customers}
            canSell={canSell}
          />
        </div>
      </div>

      {!canSell && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-800">
            <div className="font-semibold">Certification needed before you can sell {product.name}</div>
            Read the playbook below, then pass the {questionCount}-question quiz ({product.passScore}% to pass).
            {cert?.attempts ? ` Your best so far: ${cert.bestScore}%.` : ""}
          </div>
          <Link href={`/crm/products/${product.id}/quiz`} className="btn-primary">
            Take the quiz
          </Link>
        </div>
      )}
      {canSell && cert?.passedAt && (
        <div className="mb-6 text-sm text-emerald-700">
          ✅ Certified ({cert.bestScore}%) ·{" "}
          <Link href={`/crm/products/${product.id}/quiz`} className="underline">
            retake quiz
          </Link>
        </div>
      )}
      {canSell && !cert?.passedAt && questionCount > 0 && (
        <div className="mb-6 text-sm text-black/50">
          Want to test yourself?{" "}
          <Link href={`/crm/products/${product.id}/quiz`} className="text-brand-600 underline">
            Take the {questionCount}-question quiz
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {product.pitch && (
            <section className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Elevator pitch</h2>
                <CopyButton text={product.pitch} />
              </div>
              <p className="text-[15px] leading-relaxed text-black/75 whitespace-pre-wrap">{product.pitch}</p>
            </section>
          )}

          {product.description && (
            <section className="card p-6">
              <h2 className="font-semibold mb-2">What it is</h2>
              <p className="text-sm leading-relaxed text-black/70 whitespace-pre-wrap">{product.description}</p>
            </section>
          )}

          {(benefits.length > 0 || icp.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.length > 0 && (
                <section className="card p-6">
                  <h2 className="font-semibold mb-3">Key benefits</h2>
                  <ul className="space-y-2">
                    {benefits.map((b) => (
                      <li key={b} className="flex gap-2.5 text-sm text-black/70">
                        <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {icp.length > 0 && (
                <section className="card p-6">
                  <h2 className="font-semibold mb-3">Ideal customer & questions to ask</h2>
                  <ul className="space-y-2 list-disc pl-5 text-sm text-black/70">
                    {icp.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {objections.length > 0 && (
            <section className="card p-6">
              <h2 className="font-semibold mb-3">Objection handling</h2>
              <div className="space-y-3">
                {objections.map((o, i) => (
                  <div key={i} className="rounded-xl bg-sand-50 px-4 py-3">
                    <div className="text-sm font-medium">&ldquo;{o.q}&rdquo;</div>
                    {o.a && <div className="text-sm text-black/60 mt-1">{o.a}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <div className="px-6 py-4 border-b border-black/5">
              <h2 className="font-semibold">Materials</h2>
            </div>
            {materials.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-black/40">No materials for this product yet.</div>
            ) : (
              <div className="divide-y divide-black/5">
                {materials.map((m) => (
                  <div key={m.id} className="px-6 py-3.5 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <MaterialIcon type={m.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        {m.internalOnly && <Badge variant="WARN">Internal — don&apos;t send</Badge>}
                      </div>
                      <div className="text-xs text-black/40 mt-0.5">
                        {MATERIAL_TYPE_LABEL[m.type]}
                        {m.fileName ? ` · ${formatFileSize(m.fileSize)}` : " · link"}
                      </div>
                      {m.description && <p className="text-sm text-black/50 mt-0.5 line-clamp-2">{m.description}</p>}
                    </div>
                    <a href={materialHref(m)} target="_blank" rel="noreferrer" className="btn-ghost" title="Open">
                      <EyeIcon className="h-4 w-4" />
                    </a>
                    {m.fileName && (
                      <a href={`/api/materials/${m.id}?download=1`} className="btn-ghost" title="Download">
                        <DownloadIcon className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Plans & pricing</h2>
            {product.plans.length === 0 ? (
              <p className="text-sm text-black/40">No prices published yet.</p>
            ) : (
              <div className="space-y-3">
                {product.plans.map((p) => (
                  <div key={p.id} className="rounded-xl border border-black/10 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm font-semibold whitespace-nowrap">{formatPrice(p.price, p.billing)}</span>
                    </div>
                    {p.unitLabel && <div className="text-xs text-black/45">{p.unitLabel}</div>}
                    {p.description && <div className="text-xs text-black/55 mt-1">{p.description}</div>}
                  </div>
                ))}
                <p className="text-[11px] text-black/35">Prices excl. VAT.</p>
              </div>
            )}
          </section>

          <section className="card">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <h2 className="font-semibold">Your leads for this</h2>
              <Link href={`/crm/customers?product=${product.id}&stage=ALL`} className="text-xs text-brand-600 hover:underline">
                All →
              </Link>
            </div>
            {leads.length === 0 ? (
              <div className="px-5 py-6 text-sm text-black/40 text-center">
                No leads tagged with this product yet.
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {leads.map((c) => (
                  <Link
                    key={c.id}
                    href={`/crm/customers/${c.id}`}
                    className="px-5 py-3 flex items-center justify-between gap-2 hover:bg-sand-50"
                  >
                    <span className="text-sm font-medium truncate">{c.company || c.name}</span>
                    <Badge variant={c.status}>{LEAD_STATUS_LABEL[c.status]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
