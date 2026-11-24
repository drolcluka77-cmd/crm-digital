import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSellerMaterials, getSellerProducts, getSellerTemplates } from "@/lib/seller";
import Badge from "@/components/Badge";
import { FileIcon, MailIcon, PhoneIcon, BuildingIcon, LinkIcon, EyeIcon } from "@/components/icons";
import {
  computeQuoteBreakdown,
  formatMoney,
  formatDate,
  timeAgo,
} from "@/lib/format";
import { LEAD_STATUS_LABEL, LEAD_TYPE_BADGE, LEAD_TYPE_LABEL, QUOTE_STATUS_LABEL } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import WarmLeads from "../../WarmLeads";
import CustomerDetailActions from "./CustomerDetailActions";
import ActivityPanel from "./ActivityPanel";
import StagePanel from "./StagePanel";
import GeoPanel from "./GeoPanel";
import { lineForProductName } from "@/lib/geo-labels";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const t = await getT();
  const user = await requireSales();

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      quotes: { include: { items: true }, orderBy: { createdAt: "desc" } },
      interests: { include: { product: { select: { id: true, name: true, color: true } } } },
      activities: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
      shares: { include: { material: { select: { title: true } } }, orderBy: { createdAt: "desc" } },
      ugcCreator: { select: { name: true } },
      geoClients: { include: { assistant: { select: { name: true } }, _count: { select: { tasks: true } } } },
      contracts: { where: { status: "SIGNED" }, select: { id: true } },
    },
  });
  if (!customer || customer.ownerId !== user.id) notFound();
  const lastMirror = await prisma.aiMirrorRun.findFirst({
    where: { customerId: customer.id, status: { in: ["DONE", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, score: true, kind: true },
  });

  const settings = await getSettings();
  const [products, materials, templates, me] = await Promise.all([
    getSellerProducts(user),
    getSellerMaterials(user, { sendableOnly: true }),
    getSellerTemplates(user),
    prisma.user.findUnique({ where: { id: user.id }, select: { bookingUrl: true, phone: true } }),
  ]);

  // Suggest materials of the products this lead is interested in.
  const interestIds = customer.interests.map((i) => i.productId);
  // Delivery after the sale, per product line: Mr. Picked once won/signed, Unbusyness pilots any time.
  const lines = Array.from(new Set(customer.interests.map((i) => lineForProductName(i.product.name)).filter((l): l is string => !!l)));
  const deliveryPanels = await Promise.all(
    Array.from(new Set([...lines, ...customer.geoClients.map((g) => g.line)]))
      .filter((line) => customer.geoClients.some((g) => g.line === line) || ((line === "UNBUSYNESS" || line === "IMPORT") && !["NEW", "CONTACTED", "LOST"].includes(customer.status)) || customer.status === "WON" || customer.contracts.length > 0)
      .map(async (line) => {
        const g = customer.geoClients.find((x) => x.line === line);
        return {
          line,
          geo: g
            ? {
                id: g.id,
                status: g.status,
                assistant: g.assistant?.name ?? null,
                tasksDone: await prisma.geoTask.count({ where: { clientId: g.id, status: { in: ["DONE", "NOT_POSSIBLE"] } } }),
                tasksTotal: g._count.tasks,
              }
            : null,
        };
      })
  );
  const suggested = materials.filter((m) => m.productId && interestIds.includes(m.productId)).map((m) => m.id);

  const formValues = {
    id: customer.id,
    name: customer.name,
    jobTitle: customer.jobTitle,
    company: customer.company,
    segment: customer.segment,
    email: customer.email,
    phone: customer.phone,
    website: customer.website,
    city: customer.city,
    country: customer.country,
    size: customer.size,
    source: customer.source,
    note: customer.note,
    status: customer.status,
    estimatedValue: customer.estimatedValue,
    nextFollowUpAt: customer.nextFollowUpAt?.toISOString() ?? null,
    productIds: interestIds,
  };

  const details: [string, string | null][] = [
    ["Segment", customer.segment],
    ["Size", customer.size],
    ["Location", [customer.city, customer.country].filter(Boolean).join(", ") || null],
    ["Lead source", customer.source],
    ["Lead type", LEAD_TYPE_LABEL[customer.leadType] || null],
    ["UGC creator", customer.ugcCreator ? `${customer.ugcCreator.name}${customer.refCode ? ` (${customer.refCode})` : ""}` : null],
    ["Offer", customer.freeMonth ? "Used a creator code — first month free" : null],
    ["Est. value", customer.estimatedValue ? `${formatMoney(customer.estimatedValue)} / yr` : null],
    ["Added", formatDate(customer.createdAt)],
  ];

  return (
    <div>
      <Link href="/crm/customers" className="text-sm text-black/40 hover:text-black/60">
        {t("← All customers")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.company || customer.name}</h1>
            <Badge variant={customer.status}>{t(LEAD_STATUS_LABEL[customer.status])}</Badge>
            {customer.leadType !== "OTHER" && (
              <Badge variant={LEAD_TYPE_BADGE[customer.leadType] || "MUTED"}>{t(LEAD_TYPE_LABEL[customer.leadType])}</Badge>
            )}
            {customer.freeMonth && <Badge variant="WARN">{t("1st month free")}</Badge>}
          </div>
          {customer.warmAssignedAt && !customer.warmAcceptedAt && (
            <div className="mt-3 max-w-xl">
              <WarmLeads
                leads={[
                  {
                    id: customer.id,
                    name: customer.name,
                    company: customer.company,
                    phone: customer.phone,
                    product: customer.interests[0]?.product.name || null,
                    ugc: customer.leadType === "WARM_UGC",
                    freeMonth: customer.freeMonth,
                    deadline: new Date(customer.warmAssignedAt.getTime() + settings.warmClaimHours * 3_600_000).toISOString(),
                  },
                ]}
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-black/55">
            {customer.company && (
              <span className="flex items-center gap-1.5">
                <BuildingIcon className="h-3.5 w-3.5 text-black/30" />
                {customer.name}
                {customer.jobTitle ? `, ${customer.jobTitle}` : ""}
              </span>
            )}
            {!customer.company && customer.jobTitle && <span>{customer.jobTitle}</span>}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-brand-600">
                <MailIcon className="h-3.5 w-3.5 text-black/30" />
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:text-brand-600">
                <PhoneIcon className="h-3.5 w-3.5 text-black/30" />
                {customer.phone}
              </a>
            )}
            {customer.website && (
              <a
                href={customer.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-brand-600"
              >
                <LinkIcon className="h-3.5 w-3.5 text-black/30" />
                {customer.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <Link href={`/crm/mirror?customer=${customer.id}`} className="flex items-center gap-1.5 text-brand-600 hover:underline">
              ✨ AI Mirror
            </Link>
            {lastMirror && (
              <Link href={`/crm/mirror/${lastMirror.id}`} className="flex items-center gap-1.5 text-brand-600 hover:underline">
                {lastMirror.status === "RUNNING" ? "AI analiza teče …" : `AI vidnost ${lastMirror.score ?? 0} %`}
              </Link>
            )}
          </div>
        </div>
        <CustomerDetailActions
          customer={formValues}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          materials={materials}
          suggestedMaterialIds={suggested}
          templates={templates}
          interestProductIds={interestIds}
          seller={{ name: user.name, phone: me?.phone ?? null, hasBookingUrl: !!me?.bookingUrl }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {customer.note && (
            <div className="card p-5">
              <div className="section-title mb-1.5">{t("Note")}</div>
              <p className="text-sm text-black/70 whitespace-pre-wrap">{customer.note}</p>
            </div>
          )}

          <ActivityPanel
            customerId={customer.id}
            currentStatus={customer.status}
            activities={customer.activities.map((a) => ({
              id: a.id,
              type: a.type,
              body: a.body,
              userName: a.user?.name ?? null,
              mine: a.userId === user.id,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>

        <div className="space-y-4">
          {deliveryPanels.map((d) => (
            <GeoPanel key={d.line} customerId={customer.id} line={d.line} geo={d.geo} />
          ))}
          <StagePanel
            customerId={customer.id}
            status={customer.status}
            nextFollowUpAt={customer.nextFollowUpAt?.toISOString() ?? null}
            lastContactAt={customer.lastContactAt?.toISOString() ?? null}
            demoAt={customer.demoAt?.toISOString() ?? null}
          />

          <div className="card p-5">
            <div className="section-title mb-3">{t("Details")}</div>
            <dl className="space-y-2 text-sm">
              {details
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-black/45">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="card p-5">
            <div className="section-title mb-3">{t("Interested in")}</div>
            {customer.interests.length === 0 ? (
              <p className="text-sm text-black/40">{t("No products selected — edit the customer to add some.")}</p>
            ) : (
              <div className="space-y-2">
                {customer.interests.map((i) => (
                  <Link
                    key={i.productId}
                    href={`/crm/products/${i.productId}`}
                    className="flex items-center gap-2.5 text-sm hover:text-brand-600"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.product.color || "#4f46e5" }} />
                    {i.product.name}
                    <span className="ml-auto text-xs text-black/35">{t("playbook →")}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="section-title mb-3">{t("Materials sent")}</div>
            {customer.shares.length === 0 ? (
              <p className="text-sm text-black/40">{t("Nothing sent yet.")}</p>
            ) : (
              <div className="space-y-2.5">
                {customer.shares.map((s) => (
                  <div key={s.id} className="text-sm">
                    <div className="font-medium truncate">{s.material.title}</div>
                    <div className="text-xs flex items-center gap-1.5 mt-0.5">
                      {s.views > 0 ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <EyeIcon className="h-3.5 w-3.5" />
                          {t("Opened ")}{s.views}{t("× · last ")}{timeAgo(s.lastViewedAt!)}
                        </span>
                      ) : (
                        <span className="text-black/40">{t("Not opened yet · sent ")}{timeAgo(s.createdAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <div className="section-title">{t("Quotes")}</div>
              <Link href={`/crm/quotes/new?customerId=${customer.id}`} className="text-xs text-brand-600 hover:underline">
                {t("+ New quote")}
              </Link>
            </div>
            {customer.quotes.length === 0 ? (
              <div className="px-5 py-6 text-center text-black/40 text-sm">{t("No quotes yet.")}</div>
            ) : (
              <div className="divide-y divide-black/5">
                {customer.quotes.map((q) => {
                  const b = computeQuoteBreakdown(q.items, q.discount, q.vatRate);
                  return (
                    <Link
                      key={q.id}
                      href={`/crm/quotes/${q.id}`}
                      className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-sand-50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon className="h-4 w-4 text-brand-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{q.number}</div>
                          <div className="text-xs text-black/40">{formatMoney(b.annualNet)}{t(" / 1st yr")}</div>
                        </div>
                      </div>
                      <Badge variant={q.status}>{t(QUOTE_STATUS_LABEL[q.status])}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
