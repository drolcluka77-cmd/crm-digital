import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import HandoverForm, { type HandoverValues } from "./HandoverForm";

export const dynamic = "force-dynamic";

/** Guess the package, add-ons and prices from the accepted quote. */
function fromQuote(items: { name: string; billing: string; unitPrice: number; quantity: number; product: { name: string } | null }[]) {
  let pkg: string | null = null;
  const addons: string[] = [];
  let monthly = 0;
  let setup = 0;
  for (const i of items) {
    const n = `${i.product?.name || ""} ${i.name}`.toLowerCase();
    if (/concierge/.test(n) && !/whatsapp/.test(n)) pkg = "CONCIERGE";
    else if (/recommended/.test(n) && pkg !== "CONCIERGE") pkg = "RECOMMENDED";
    else if (/visible/.test(n) && !pkg) pkg = "VISIBLE";
    if (/video/.test(n)) addons.push("VIDEOS");
    if (/ocen|review/.test(n)) addons.push("REVIEWS");
    if (/whatsapp/.test(n)) addons.push("WHATSAPP");
    if (/spletn|website/.test(n)) addons.push("WEBSITE");
    if (i.billing === "MONTHLY") monthly += i.unitPrice * i.quantity;
    else if (i.billing === "YEARLY") monthly += (i.unitPrice * i.quantity) / 12;
    else setup += i.unitPrice * i.quantity;
  }
  return { pkg, addons: Array.from(new Set(addons)), monthly: monthly || null, setup: setup || null };
}

export default async function HandoverPage({ params }: { params: { id: string } }) {
  const user = await requireSales();
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      geoClient: true,
      quotes: { where: { status: "ACCEPTED" }, include: { items: { include: { product: { select: { name: true } } } } }, orderBy: { decidedAt: "desc" }, take: 1 },
    },
  });
  if (!customer || customer.ownerId !== user.id) notFound();
  const g = customer.geoClient;
  const q = customer.quotes[0] ? fromQuote(customer.quotes[0].items) : null;
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const values: HandoverValues = g
    ? {
        company: g.company,
        industry: g.industry || "",
        package: g.package || "",
        addons: (g.addons as string[]) || [],
        monthlyPrice: g.monthlyPrice ? String(g.monthlyPrice) : "",
        setupFee: g.setupFee ? String(g.setupFee) : "",
        startDate: iso(g.startDate),
        contactName: g.contactName || "",
        contactPhone: g.contactPhone || "",
        contactEmail: g.contactEmail || "",
        webManager: g.webManager || "",
        customerValue: g.customerValue ? String(g.customerValue) : "",
        mainProblem: g.mainProblem || "",
        languages: (g.languages as string[]) || [],
        promised: g.promised || "",
        specialNotes: g.specialNotes || "",
      }
    : {
        company: customer.company || customer.name,
        industry: "",
        package: q?.pkg || "",
        addons: q?.addons || [],
        monthlyPrice: q?.monthly ? String(Math.round(q.monthly * 100) / 100) : "",
        setupFee: q?.setup ? String(q.setup) : "",
        startDate: new Date().toISOString().slice(0, 10),
        contactName: customer.name,
        contactPhone: customer.phone || "",
        contactEmail: customer.email || "",
        webManager: "",
        customerValue: "",
        mainProblem: "",
        languages: ["SL"],
        promised: "",
        specialNotes: "",
      };
  const locked = !!g && g.status !== "DRAFT";
  return (
    <div className="max-w-3xl">
      <Link href={`/crm/customers/${customer.id}`} className="text-sm text-black/40 hover:text-black/60">
        ← {customer.company || customer.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-3">Predaja v izvedbo</h1>
      <p className="text-black/50 text-sm mt-1 mb-6">
        GEO asistent bo delal samo s temi podatki, zato jih izpolni natančno. Polja z * so obvezna. Ko oddaš, podatkov ne
        moreš več urejati.
      </p>
      {locked ? (
        <div className="card p-5 text-sm">Predaja je že oddana. Napredek vidiš na strani stranke.</div>
      ) : (
        <HandoverForm customerId={customer.id} values={values} fromQuote={!g && !!q} />
      )}
    </div>
  );
}
