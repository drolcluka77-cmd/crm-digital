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
      logs: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!c) notFound();
  if ((user.role === "GEO" || user.role === "FDE") && c.assistantId !== user.id) notFound();
  const isAdmin = user.role === "ADMIN";
  const unb = c.line === "UNBUSYNESS";
  const d = (c.details as UnbDetails) || {};
  const tabs = unb ? TABS.filter(([k]) => ["predaja", "dostopi", "naloge", "zgodovina"].includes(k)) : TABS;
  const tab = tabs.some(([k]) => k === searchParams.tab) ? searchParams.tab! : !unb && c.status === "KICKOFF" ? "kartica" : "naloge";
  const card = asCard(c.card);
  const missing = missingCardFields(card, c.package);
  const assistants = isAdmin
    ? await prisma.user.findMany({ where: { role: { in: [DELIVERY_LINE_ROLE[c.line] || "GEO", "ADMIN"] }, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
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
            {unb ? (
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
            {!unb && (
              <>
                <Field k="Mesečna cena" v={c.monthlyPrice ? `${c.monthlyPrice} €` : null} />
                <Field k="Enkratna namestitev" v={c.setupFee ? `${c.setupFee} €` : null} />
                <Field k="Kdo ureja stran" v={c.webManager} />
                <Field k="Vrednost ene stranke" v={c.customerValue ? `${c.customerValue} €` : null} />
              </>
            )}
            <Field k="Glavni problem" v={c.mainProblem} />
            <Field k={unb ? "Jeziki gostov" : "Jeziki strank"} v={asStrings(c.languages).join(", ")} />
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

      {tab === "meritve" && (
        <Measurements
          clientId={c.id}
          isAdmin={isAdmin}
          status={c.status}
          day90Done={!!c.day90DoneAt}
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
