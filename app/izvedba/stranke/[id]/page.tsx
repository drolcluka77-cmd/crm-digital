import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGeoArea } from "@/lib/session";
import {
  GEO_ADDON_LABEL,
  GEO_INDUSTRY_LABEL,
  GEO_PACKAGE_LABEL,
  GEO_STATUS_LABEL,
  statusNext,
  DELIVERY_LINE_LABEL,
  DELIVERY_LINE_ROLE,
  UNB_PROPERTY_TYPES,
  UNB_BOOKING_CHANNELS,
  UNB_GUEST_CHANNELS,
  type UnbDetails,
  type ImportDetails,
  IMPORT_INCOTERMS,
  missingCardFields,
  fmtDay,
} from "@/lib/geo-labels";
import { asCard, asStrings } from "@/lib/geo";
import {
  buildDeveloperEmail,
  buildFooterHtml,
  buildLlmsTxt,
  buildRobotsLines,
  schemaScriptTag,
  schemaTypeFor,
  PLATFORM_STEPS,
} from "@/lib/geo-code";
import TaskList, { type TaskRow } from "../../TaskList";
import CardEditor from "./CardEditor";
import AccessList from "./AccessList";
import Measurements from "./Measurements";
import OffersTab from "./OffersTab";
import MirrorForm from "@/components/MirrorForm";
import { mirrorBudget, mirrorEngines } from "@/lib/ai-mirror";
import CodeTab from "./CodeTab";
import AdminControls from "./AdminControls";
import AddTask from "./AddTask";

export const dynamic = "force-dynamic";

const TABS = [
  ["predaja", "Predaja"],
  ["kartica", "Kartica"],
  ["dostopi", "Dostopi"],
  ["naloge", "Naloge"],
  ["meritve", "Meritve"],
  ["koda", "Koda"],
  ["dobavitelji", "Dobavitelji"],
  ["zgodovina", "Zgodovina"],
] as const;

export default async function GeoClientPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const user = await requireGeoArea();
  const c = await prisma.geoClient.findUnique({
    where: { id: params.id },
    include: {
      assistant: { select: { id: true, name: true } },
      seller: { select: { name: true } },
      accesses: { orderBy: { platform: "asc" } },
      tasks: { include: { assignee: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
      measurements: { orderBy: [{ month: "asc" }, { createdAt: "asc" }] },
      offers: { orderBy: { createdAt: "asc" } },
      logs: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!c) notFound();
  if (["GEO", "FDE", "IMPORT", "ADS"].includes(user.role) && c.assistantId !== user.id && c.adsAssistantId !== user.id) notFound();
  const isAdmin = user.role === "ADMIN";
  const unb = c.line === "UNBUSYNESS";
  const imp = c.line === "IMPORT";
  const d = (c.details as UnbDetails) || {};
  const di = (c.details as ImportDetails) || {};
  const tabs = unb
    ? TABS.filter(([k]) => ["predaja", "dostopi", "naloge", "zgodovina"].includes(k))
    : imp
      ? TABS.filter(([k]) => ["predaja", "dobavitelji", "naloge", "zgodovina"].includes(k))
      : TABS.filter(([k]) => k !== "dobavitelji");
  const tab = tabs.some(([k]) => k === searchParams.tab) ? searchParams.tab! : c.line === "PICKED" && c.status === "KICKOFF" ? "kartica" : "naloge";
  const card = asCard(c.card);
  const mirrorRuns =
    c.line === "PICKED"
      ? await prisma.aiMirrorRun.findMany({
          where: { geoClientId: c.id },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { id: true, status: true, score: true, createdAt: true, measurementId: true },
        })
      : [];
  const missing = missingCardFields(card, c.package);
  const assistants = isAdmin
    ? await prisma.user.findMany({ where: { role: { in: [DELIVERY_LINE_ROLE[c.line] || "GEO", "ADMIN"] }, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
    : [];
  const hasLeadEngine = asStrings(c.addons).includes("LEAD_ENGINE");
  const adsAssistants =
    isAdmin && hasLeadEngine
      ? await prisma.user.findMany({ where: { role: { in: ["ADS", "ADMIN"] }, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : [];

  const tasks: TaskRow[] = c.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    phase: t.phase,
    dueDate: t.dueDate?.toISOString() ?? null,
    status: t.status,
    note: t.note,
    needsApproval: t.needsApproval,
    technical: t.technical,
    clientId: t.clientId,
    assignee: t.assignee?.name ?? null,
  }));
  const openTasks = tasks.filter((t) => !["DONE", "NOT_POSSIBLE"].includes(t.status));
  const doneTasks = tasks.filter((t) => ["DONE", "NOT_POSSIBLE"].includes(t.status));

  const Field = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="grid grid-cols-[180px_1fr] gap-3 py-1.5 text-sm border-b border-black/5 last:border-0">
      <dt className="text-black/45">{k}</dt>
      <dd className="whitespace-pre-wrap">{v || "—"}</dd>
    </div>
  );

  return (
    <div>
      <Link href="/izvedba/stranke" className="text-sm text-black/40 hover:text-black/60">
        ← Stranke
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.company}</h1>
          <div className="text-sm text-black/55 mt-1">
            <span className="font-medium text-black/70">{DELIVERY_LINE_LABEL[c.line]}</span> ·{" "}
            {imp ? (
              <>
                {di.product || "—"}
                {di.quantity ? ` · ${di.quantity}` : ""} · začetek {fmtDay(c.startDate?.toISOString() ?? null)} · koordinator{" "}
                {c.assistant?.name || "ni dodeljen"}
              </>
            ) : unb ? (
              <>
                {d.units ? `${d.units} enot` : "—"} · začetek {fmtDay(c.startDate?.toISOString() ?? null)} · FDE {c.assistant?.name || "ni dodeljen"}
              </>
            ) : (
              <>
            {GEO_PACKAGE_LABEL[c.package || ""] || "—"}
            {asStrings(c.addons).length ? ` + ${asStrings(c.addons).map((a) => GEO_ADDON_LABEL[a] || a).join(", ")}` : ""} ·{" "}
            {GEO_INDUSTRY_LABEL[c.industry || ""] || "—"} · začetek {fmtDay(c.startDate?.toISOString() ?? null)} · asistent{" "}
            {c.assistant?.name || "ni dodeljen"}
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium">{GEO_STATUS_LABEL[c.status]}</span>
            {statusNext(c.line, c.status) && <span className="text-black/45">Naprej, ko: {statusNext(c.line, c.status)}</span>}
            {unb && d.outcome && (
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">
                {d.outcome === "CONVERTED" ? "Nadaljuje kot plačljiva stranka" : "Pilot končan brez nadaljevanja"}
              </span>
            )}
            {c.freeMonth4 && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">4. mesec brezplačen</span>}
          </div>
        </div>
        {isAdmin && (
          <AdminControls
            clientId={c.id}
            line={c.line}
            status={c.status}
            assistantId={c.assistantId}
            assistants={assistants.map((a) => ({ id: a.id, name: a.role === "ADMIN" ? `${a.name} (admin)` : a.name }))}
            hasLeadEngine={hasLeadEngine}
            adsAssistantId={c.adsAssistantId}
            adsAssistants={adsAssistants.map((a) => ({ id: a.id, name: a.role === "ADMIN" ? `${a.name} (admin)` : a.name }))}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5 border-b border-black/5 pb-3">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/izvedba/stranke/${c.id}?tab=${k}`} className={tab === k ? "chip-active" : "chip"}>
            {label}
            {k === "kartica" && missing.length > 0 && <span className="ml-1.5 text-amber-600">•</span>}
            {k === "naloge" && <span className="ml-1.5 opacity-60">{openTasks.length}</span>}
          </Link>
        ))}
      </div>

      {tab === "predaja" && (
        <div className="card p-5">
          <dl>
            <Field k="Prodajalec" v={c.seller?.name} />
            {unb && (
              <>
                <Field k="Vrsta nastanitve" v={UNB_PROPERTY_TYPES[d.propertyType || ""]} />
                <Field k="Število enot" v={d.units ? String(d.units) : null} />
                <Field k="Lokacije" v={d.locations} />
                <Field k="Kanali rezervacij" v={(d.bookingChannels || []).map((x) => UNB_BOOKING_CHANNELS[x] || x).join(", ")} />
                <Field k="Kje gostje pišejo" v={(d.guestChannels || []).map((x) => UNB_GUEST_CHANNELS[x] || x).join(", ")} />
                <Field k="Sistem za rezervacije" v={d.pms} />
                <Field k="Kdo zdaj odgovarja gostom" v={d.whoAnswers} />
                <Field k="Cilj pilota" v={d.pilotGoal} />
                <Field k="Trajanje pilota" v={d.pilotDays ? `${d.pilotDays} dni po zagonu` : null} />
                <Field k="Cena po pilotu" v={d.priceAfterPilot ? `${d.priceAfterPilot} € / mesec` : null} />
                {d.outcomeNote && <Field k="Zaključek pilota" v={d.outcomeNote} />}
              </>
            )}
            <Field k="Kontaktna oseba" v={[c.contactName, c.contactPhone, c.contactEmail].filter(Boolean).join(" · ")} />
            {imp && (
              <>
                <Field k="Izdelek" v={di.product} />
                <Field k="Specifikacija" v={di.specs} />
                <Field k="Količina" v={di.quantity} />
                <Field k="Ciljna cena na kos" v={di.targetPrice} />
                <Field k="Proračun" v={di.budget ? `${di.budget} €` : null} />
                <Field k="Želeni rok dostave" v={di.deadline ? fmtDay(di.deadline) : null} />
                <Field k="Dostava" v={IMPORT_INCOTERMS[di.incoterm || ""]} />
                <Field k="Kraj dostave" v={di.deliveryAddress} />
                <Field k="Certifikati / zahteve" v={di.certifications} />
                <Field k="Vzorci" v={di.samples ? "da" : "ne"} />
                <Field k="149 € za iskanje plačano" v={di.searchFeePaid ? "da" : "ne"} />
                <Field k="Pogodba o proviziji" v={di.commissionContract ? `podpisana${di.commissionPct ? ` · ${di.commissionPct} %` : ""} (najmanj 500 € na naročilo)` : "ne"} />
                <Field k="Primer / referenca" v={di.reference} />
              </>
            )}
            {c.line === "PICKED" && (
              <>
                <Field k="Mesečna cena" v={c.monthlyPrice ? `${c.monthlyPrice} €` : null} />
                <Field k="Enkratna namestitev" v={c.setupFee ? `${c.setupFee} €` : null} />
                <Field k="Kdo ureja stran" v={c.webManager} />
                <Field k="Vrednost ene stranke" v={c.customerValue ? `${c.customerValue} €` : null} />
              </>
            )}
            <Field k="Glavni problem" v={c.mainProblem} />
            {!imp && <Field k={unb ? "Jeziki gostov" : "Jeziki strank"} v={asStrings(c.languages).join(", ")} />}
            <Field k="Kaj je prodajalec obljubil" v={c.promised} />
            <Field k="Posebnosti" v={c.specialNotes} />
            <Field k="Predano" v={c.handedOverAt ? c.handedOverAt.toLocaleString("sl-SI") : null} />
          </dl>
        </div>
      )}

      {tab === "kartica" && <CardEditor clientId={c.id} card={card} pkg={c.package} industry={c.industry} missing={missing} updated={c.cardUpdatedAt ? `${c.cardUpdatedAt.toLocaleString("sl-SI")} · ${c.cardUpdatedBy || ""}` : null} />}

      {tab === "dostopi" && (
        <AccessList
          clientId={c.id}
          rows={c.accesses.map((a) => ({ id: a.id, platform: a.platform, status: a.status, method: a.method, note: a.note, updatedAt: a.updatedAt.toISOString() }))}
        />
      )}

      {tab === "naloge" && (
        <div className="space-y-5">
          <div className="card">
            <div className="px-4 pt-4 pb-2 font-semibold">
              Odprte <span className="text-black/40 font-normal">{openTasks.length}</span>
            </div>
            <TaskList tasks={openTasks} isAdmin={isAdmin} showClient={false} empty="Ni odprtih nalog." />
          </div>
          <AddTask clientId={c.id} />
          <div className="card">
            <div className="px-4 pt-4 pb-2 font-semibold">
              Končane <span className="text-black/40 font-normal">{doneTasks.length}</span>
            </div>
            <TaskList tasks={doneTasks.reverse()} isAdmin={isAdmin} showClient={false} empty="Še nič končanega." />
          </div>
        </div>
      )}

      {tab === "dobavitelji" && (
        <OffersTab
          clientId={c.id}
          quantity={(() => {
            const n = parseInt(String(di.quantity || "").replace(/[^\d]/g, ""), 10);
            return Number.isFinite(n) && n > 0 ? n : null;
          })()}
          offers={c.offers.map((o) => ({
            id: o.id,
            supplier: o.supplier,
            location: o.location,
            contact: o.contact,
            unitPrice: o.unitPrice,
            currency: o.currency,
            moq: o.moq,
            leadDays: o.leadDays,
            incoterm: o.incoterm,
            certificates: o.certificates,
            sampleCost: o.sampleCost,
            verified: o.verified,
            status: o.status,
            note: o.note,
          }))}
        />
      )}

      {tab === "meritve" && (
        <div className="space-y-4 mb-5">
          <div>
            <div className="font-semibold mb-1">AI Mirror — samodejna meritev</div>
            <p className="text-sm text-black/55 mb-3">
              Vpraša ChatGPT in Gemini (s spletnim iskanjem) ista vprašanja kot ob izhodišču in prešteje omembe. Rezultat pregledaš in shraniš kot meritev.
            </p>
            <MirrorForm
              basePath="/izvedba/mirror"
              compact
              budget={{ ...(await mirrorBudget(user.id)), engines: mirrorEngines().map((e) => (e === "chatgpt" ? "ChatGPT" : "Gemini")) }}
              prefill={{ company: c.company, city: card.city, category: card.primaryCategory, website: card.website, phone: card.phone, geoClientId: c.id }}
            />
          </div>
          {mirrorRuns.length > 0 && (
            <div className="card p-4 text-sm">
              <div className="font-medium mb-1">Pretekle AI Mirror meritve</div>
              {mirrorRuns.map((r) => (
                <div key={r.id} className="flex gap-3 py-0.5">
                  <Link href={`/izvedba/mirror/${r.id}`} className="text-brand-600 underline">
                    {r.createdAt.toLocaleDateString("sl-SI")}
                  </Link>
                  <span>{r.status === "DONE" ? `${r.score ?? 0} %` : r.status === "FAILED" ? "napaka" : "teče …"}</span>
                  {r.measurementId && <span className="text-emerald-700">shranjeno kot meritev</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "meritve" && (
        <Measurements
          clientId={c.id}
          isAdmin={isAdmin}
          status={c.status}
          day90Done={!!c.day90DoneAt}
          company={c.company}
          assistantName={c.assistant?.name ?? null}
          tasks={c.tasks.map((t) => ({ title: t.title, status: t.status, doneAt: t.doneAt?.toISOString() ?? null, dueDate: t.dueDate?.toISOString() ?? null }))}
          nextMonth={c.measurements.length ? Math.max(...c.measurements.map((m) => m.month)) + 1 : 0}
          rows={c.measurements.map((m) => ({
            id: m.id,
            month: m.month,
            at: m.measuredAt.toISOString(),
            answers: m.answers,
            mentions: m.mentions,
            score: m.score,
            mapRanks: (m.mapRanks as any[]) || [],
            wrongFacts: asStrings(m.wrongFacts),
            reportUrl: m.reportUrl,
            note: m.note,
          }))}
        />
      )}

      {tab === "koda" && (
        <CodeTab
          clientId={c.id}
          ready={missing.filter((m) => !m.startsWith("AI vprašanja") && !m.startsWith("Ključna") && !m.startsWith("Fotografije")).length === 0}
          platform={card.sitePlatform || ""}
          steps={PLATFORM_STEPS[card.sitePlatform || ""] || []}
          schemaType={schemaTypeFor(c.industry, card)}
          schema={schemaScriptTag(card, c.industry)}
          llms={buildLlmsTxt(card, c.industry)}
          robots={buildRobotsLines(card)}
          footer={buildFooterHtml(card)}
          email={buildDeveloperEmail(card, c.industry, { name: user.name })}
          devContact={c.webManager}
          website={card.website || ""}
          lastCheck={(c.lastCheck as any) || null}
        />
      )}

      {tab === "zgodovina" && (
        <div className="card">
          <ul className="divide-y divide-black/5">
            {c.logs.map((l) => (
              <li key={l.id} className="px-4 py-2.5 text-sm flex flex-wrap gap-x-3">
                <span className="text-black/40 w-36 shrink-0">{l.createdAt.toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="text-black/55 w-32 shrink-0">{l.userName}</span>
                <span className="flex-1 min-w-[200px]">{l.detail || l.action}</span>
              </li>
            ))}
            {c.logs.length === 0 && <li className="px-4 py-6 text-center text-sm text-black/40">Še ni zapisov.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
