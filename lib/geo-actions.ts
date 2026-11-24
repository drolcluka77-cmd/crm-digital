"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { notify } from "@/lib/notify";
import {
  GEO_ADDONS,
  GEO_INDUSTRIES,
  GEO_LANGUAGES,
  GEO_PACKAGES,
  GEO_PLATFORMS,
  GEO_ACCESS_STATUSES,
  GEO_TASK_STATUSES,
  GEO_TEMPLATE_GROUPS,
  GEO_PHASES,
  GEO_STATUSES,
  GEO_ACTIVE_STATUSES,
  GEO_PLATFORM_LABEL,
  GEO_TASK_STATUS_LABEL,
  missingHandoverFor,
  DELIVERY_LINE_ROLE,
  DELIVERY_LINE_LABEL,
  UNB_PROPERTY_TYPES,
  UNB_BOOKING_CHANNELS,
  UNB_GUEST_CHANNELS,
  type GeoCard,
  type UnbDetails,
  type ImportDetails,
  IMPORT_INCOTERMS,
  IMPORT_OFFER_STATUSES,
  IMPORT_OFFER_STATUS_LABEL,
  IMPORT_CURRENCIES,
  DELIVERY_ROLES,
} from "@/lib/geo-labels";
import {
  advanceGeoClient,
  asCard,
  createOnceTasks,
  createRecurringTasks,
  createUpdateTasksForChange,
  ensureAccessRows,
  geoAdmins,
  geoLog,
  napChanged,
} from "@/lib/geo";
import { verifySite } from "@/lib/geo-verify";

export type GeoResult = { error?: string; success?: string; id?: string } | void;

const DAY = 86_400_000;
const str = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").trim().slice(0, max) || null;
const num = (fd: FormData, k: string) => {
  const v = Number(String(fd.get(k) ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
};
const isStaff = (u: CurrentUser) => u.role === "ADMIN" || u.role === "MANAGER";

function revalidateClient(id: string, customerId?: string) {
  revalidatePath(`/izvedba/stranke/${id}`);
  revalidatePath("/izvedba");
  revalidatePath("/izvedba/stranke");
  revalidatePath("/admin/geo");
  if (customerId) revalidatePath(`/crm/customers/${customerId}`);
}

/** The client if this user may work on it (assistant on it, admin, manager). */
async function clientForWork(user: CurrentUser, clientId: string) {
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c) return null;
  if (isStaff(user)) return c;
  if (DELIVERY_ROLES.includes(user.role) && c.assistantId === user.id) return c;
  return null;
}

// ─── Seller: handover ─────────────────────────────────────────────────────

export async function saveHandover(customerId: string, fd: FormData, submit: boolean, line = "PICKED"): Promise<GeoResult> {
  const user = await requireUser();
  if (!DELIVERY_LINE_LABEL[line]) return { error: "Neznana vrsta izvedbe." };
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { geoClients: { where: { line } } } });
  if (!customer) return { error: "Stranke ni mogoče najti." };
  if (user.role === "SALES" && customer.ownerId !== user.id) return { error: "To ni vaša stranka." };
  if (!["SALES", "ADMIN", "MANAGER"].includes(user.role)) return { error: "Ni dovoljeno." };
  const existing = customer.geoClients[0] ?? null;
  if (existing && existing.status !== "DRAFT" && !isStaff(user))
    return { error: "Stranka je že predana. Po predaji lahko dodajate samo zapiske." };

  const pkg = str(fd, "package");
  const industry = str(fd, "industry");
  const startRaw = str(fd, "startDate");
  const addons = fd.getAll("addons").map(String).filter((a) => (GEO_ADDONS as readonly string[]).includes(a));
  const languages = fd.getAll("languages").map(String).filter((a) => (GEO_LANGUAGES as readonly string[]).includes(a));
  const pick = (k: string, allowed: Record<string, string>) => fd.getAll(k).map(String).filter((v) => v in allowed);
  const details: UnbDetails | undefined =
    line === "UNBUSYNESS"
      ? {
          ...((existing?.details as UnbDetails) || {}),
          propertyType: str(fd, "propertyType") && str(fd, "propertyType")! in UNB_PROPERTY_TYPES ? str(fd, "propertyType")! : undefined,
          units: num(fd, "units"),
          locations: str(fd, "locations", 300) || undefined,
          bookingChannels: pick("bookingChannels", UNB_BOOKING_CHANNELS),
          guestChannels: pick("guestChannels", UNB_GUEST_CHANNELS),
          pms: str(fd, "pms", 200) || undefined,
          whoAnswers: str(fd, "whoAnswers", 500) || undefined,
          pilotGoal: str(fd, "pilotGoal", 1000) || undefined,
          pilotDays: num(fd, "pilotDays") || 30,
          priceAfterPilot: num(fd, "priceAfterPilot"),
        }
      : undefined;
  const importDetails: ImportDetails | undefined =
    line === "IMPORT"
      ? {
          ...((existing?.details as ImportDetails) || {}),
          product: str(fd, "product", 300) || undefined,
          specs: str(fd, "specs", 2000) || undefined,
          quantity: str(fd, "quantity", 100) || undefined,
          targetPrice: str(fd, "targetPrice", 100) || undefined,
          budget: num(fd, "budget"),
          deadline: str(fd, "deadline", 10) || undefined,
          incoterm: str(fd, "incoterm") && str(fd, "incoterm")! in IMPORT_INCOTERMS ? str(fd, "incoterm")! : undefined,
          deliveryAddress: str(fd, "deliveryAddress", 300) || undefined,
          certifications: str(fd, "certifications", 300) || undefined,
          samples: fd.get("samples") === "on",
          searchFeePaid: fd.get("searchFeePaid") === "on",
          commissionContract: fd.get("commissionContract") === "on",
          commissionPct: num(fd, "commissionPct"),
          reference: str(fd, "reference", 500) || undefined,
        }
      : undefined;
  const data = {
    line,
    ...(details ? { details: details as any, package: "PILOT", industry: "LODGING" } : {}),
    company: str(fd, "company", 200) || customer.company || customer.name,
    industry: industry && (GEO_INDUSTRIES as readonly string[]).includes(industry) ? industry : null,
    package: pkg && (GEO_PACKAGES as readonly string[]).includes(pkg) ? pkg : null,
    addons,
    monthlyPrice: num(fd, "monthlyPrice"),
    setupFee: num(fd, "setupFee"),
    startDate: startRaw ? new Date(`${startRaw}T09:00:00Z`) : null,
    contactName: str(fd, "contactName", 120),
    contactPhone: str(fd, "contactPhone", 40),
    contactEmail: (str(fd, "contactEmail", 160) || "").toLowerCase() || null,
    webManager: str(fd, "webManager", 300),
    customerValue: num(fd, "customerValue"),
    mainProblem: str(fd, "mainProblem"),
    languages,
    promised: str(fd, "promised"),
    specialNotes: str(fd, "specialNotes"),
  };
  if (data.startDate && isNaN(data.startDate.getTime())) return { error: "Datum začetka ni pravilen." };

  if (line === "UNBUSYNESS") {
    delete (data as any).package;
    delete (data as any).industry;
    Object.assign(data, { package: "PILOT", industry: "LODGING", monthlyPrice: details?.priceAfterPilot ?? null });
  }
  if (line === "IMPORT") {
    Object.assign(data, { details: importDetails as any, package: "IMPORT", industry: "OTHER", monthlyPrice: null });
  }
  if (submit) {
    const missing = missingHandoverFor(line, { ...data, details: line === "IMPORT" ? importDetails : details });
    if (missing.length) return { error: `Manjka: ${missing.join(", ")}.` };
  }
  const contract = await prisma.contract.findFirst({
    where: { customerId, status: "SIGNED" },
    orderBy: { signedAt: "desc" },
    select: { id: true },
  });
  const c = existing
    ? await prisma.geoClient.update({ where: { id: existing.id }, data })
    : await prisma.geoClient.create({
        data: { ...data, customerId, sellerId: customer.ownerId, contractId: contract?.id ?? null },
      });
  if (submit && c.status === "DRAFT") {
    await prisma.geoClient.update({ where: { id: c.id }, data: { status: "HANDED_OVER", statusAt: new Date(), handedOverAt: new Date() } });
    await geoLog(c.id, user, "HANDOVER", "Prodajalec je oddal predajo.");
    await notify(await geoAdmins(), {
      type: "GEO",
      title: `Nova predaja v izvedbo (${DELIVERY_LINE_LABEL[line]}): ${c.company}`,
      body: line === "UNBUSYNESS" ? "Dodeli forward deployment engineerja." : line === "IMPORT" ? "Dodeli koordinatorja uvoza." : "Dodeli GEO asistenta.",
      link: "/admin/geo",
    });
  } else {
    await geoLog(c.id, user, "HANDOVER_SAVED", existing ? "Predaja posodobljena." : "Osnutek predaje ustvarjen.");
  }
  revalidateClient(c.id, customerId);
  return {
    success: submit
      ? `Predano v izvedbo. Administrator bo dodelil ${line === "UNBUSYNESS" ? "forward deployment engineerja" : line === "IMPORT" ? "koordinatorja uvoza" : "GEO asistenta"}.`
      : "Osnutek shranjen.",
    id: c.id,
  };
}

// ─── Admin: assign, status, day 90, cancel ───────────────────────────────

export async function assignAssistant(clientId: string, assistantId: string): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Asistenta dodeli administrator." };
  const [c, a] = await Promise.all([
    prisma.geoClient.findUnique({ where: { id: clientId } }),
    prisma.user.findUnique({ where: { id: assistantId } }),
  ]);
  if (!c) return { error: "Stranke ni mogoče najti." };
  const role = DELIVERY_LINE_ROLE[c.line] || "GEO";
  if (!a || !a.active || ![role, "ADMIN"].includes(a.role))
    return { error: c.line === "UNBUSYNESS" ? "Izberite forward deployment engineerja." : c.line === "IMPORT" ? "Izberite koordinatorja uvoza." : "Izberite GEO asistenta." };
  if (c.status === "DRAFT") return { error: "Prodajalec predaje še ni oddal." };
  const missingH = missingHandoverFor(c.line, c);
  if (missingH.length) return { error: `Predaji manjka: ${missingH.join(", ")}.` };

  const previous = c.assistantId;
  await prisma.geoClient.update({ where: { id: clientId }, data: { assistantId, approvedAt: c.approvedAt ?? new Date() } });
  if (previous && previous !== assistantId) {
    await prisma.geoTask.updateMany({
      where: { clientId, assigneeId: previous, status: { notIn: ["DONE", "NOT_POSSIBLE"] } },
      data: { assigneeId: assistantId },
    });
  }
  await ensureAccessRows(clientId, c.industry, c.line, c.details);
  const once = await createOnceTasks(clientId);
  await geoLog(clientId, user, "ASSIGN", `Asistent: ${a.name}`);
  await advanceGeoClient(clientId, user);
  const rec = await createRecurringTasks(clientId);
  await notify([assistantId], {
    type: "GEO",
    title: `Nova stranka: ${c.company}`,
    body: `${c.line === "UNBUSYNESS" ? "Uvodni klic z lastnikom v 2 dneh." : c.line === "IMPORT" ? "Uvodni klic s stranko v 2 dneh." : "Uvodni klic in kartica podjetja v 3 dneh."}${once + rec ? ` Ustvarjenih nalog: ${once + rec}.` : ""}`,
    link: `/izvedba/stranke/${clientId}`,
  });
  revalidateClient(clientId, c.customerId);
  return { success: `Dodeljeno: ${a.name}. Ustvarjenih nalog: ${once + rec}.` };
}

export async function setGeoStatus(clientId: string, status: string): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Samo administrator." };
  if (!(GEO_STATUSES as readonly string[]).includes(status)) return { error: "Neznan status." };
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c) return { error: "Stranke ni mogoče najti." };
  await prisma.geoClient.update({ where: { id: clientId }, data: { status, statusAt: new Date() } });
  await geoLog(clientId, user, "STATUS", `Ročno: ${c.status} → ${status}`);
  if (GEO_ACTIVE_STATUSES.includes(status)) await createRecurringTasks(clientId);
  revalidateClient(clientId, c.customerId);
  return { success: "Status spremenjen." };
}

export async function confirmDay90(clientId: string, freeMonth4: boolean): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Samo administrator." };
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c) return { error: "Stranke ni mogoče najti." };
  await prisma.geoClient.update({
    where: { id: clientId },
    data: { day90DoneAt: new Date(), freeMonth4, status: "MAINTENANCE", statusAt: new Date() },
  });
  await prisma.geoTask.updateMany({
    where: { clientId, key: "day90", status: { notIn: ["DONE", "NOT_POSSIBLE"] } },
    data: { status: "DONE", doneAt: new Date(), approvedById: user.id },
  });
  await geoLog(clientId, user, "DAY90", freeMonth4 ? "Potrjeno — 4. mesec brezplačen." : "Potrjeno — obljuba izpolnjena.");
  revalidateClient(clientId, c.customerId);
  return { success: freeMonth4 ? "Potrjeno: 4. mesec je brezplačen." : "Potrjeno." };
}

export async function cancelGeoClient(clientId: string): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Samo administrator." };
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c) return { error: "Stranke ni mogoče najti." };
  const endsAt = new Date(Date.now() + 60 * DAY);
  await prisma.geoClient.update({ where: { id: clientId }, data: { status: "CANCELLED", statusAt: new Date(), cancelledAt: new Date(), endsAt } });
  await geoLog(clientId, user, "CANCEL", `Odpoved; naloge se ustavijo ${endsAt.toLocaleDateString("sl-SI")}.`);
  revalidateClient(clientId, c.customerId);
  return { success: "Označeno kot prekinjeno (60-dnevni odpovedni rok)." };
}

// ─── Assistant: company card ──────────────────────────────────────────────

export async function saveCard(clientId: string, cardJson: string): Promise<GeoResult> {
  const user = await requireUser();
  const c = await clientForWork(user, clientId);
  if (!c) return { error: "Ni dovoljeno." };
  let card: GeoCard;
  try {
    card = JSON.parse(cardJson);
    if (!card || typeof card !== "object") throw new Error();
  } catch {
    return { error: "Podatki kartice niso pravilni." };
  }
  if (cardJson.length > 200_000) return { error: "Kartica je prevelika." };
  const before = asCard(c.card);
  const changed = napChanged(before, card);
  await prisma.geoClient.update({
    where: { id: clientId },
    data: { card: card as any, cardUpdatedAt: new Date(), cardUpdatedBy: user.name },
  });
  await geoLog(clientId, user, "CARD", changed.length ? `Spremenjeno: ${changed.join(", ")}` : "Kartica shranjena.");
  const extra = changed.length ? await createUpdateTasksForChange(clientId, changed) : 0;
  await prisma.geoTask.updateMany({
    where: { clientId, key: "kickoff-card", status: { in: ["OPEN", "IN_PROGRESS"] } },
    data: { status: "IN_PROGRESS" },
  });
  const status = await advanceGeoClient(clientId, user);
  if (status !== "KICKOFF" && status !== "HANDED_OVER") {
    await prisma.geoTask.updateMany({
      where: { clientId, key: "kickoff-card", status: { notIn: ["DONE", "NOT_POSSIBLE"] } },
      data: { status: "DONE", doneAt: new Date() },
    });
  }
  revalidateClient(clientId, c.customerId);
  return { success: `Kartica shranjena.${extra ? ` Ustvarjenih nalog za posodobitev: ${extra}.` : ""}` };
}

// ─── Accesses ─────────────────────────────────────────────────────────────

export async function saveAccess(accessId: string, fd: FormData): Promise<GeoResult> {
  const user = await requireUser();
  const a = await prisma.geoAccess.findUnique({ where: { id: accessId } });
  if (!a) return { error: "Ni najdeno." };
  const c = await clientForWork(user, a.clientId);
  if (!c) return { error: "Ni dovoljeno." };
  const status = str(fd, "status") || "NOT_REQUESTED";
  if (!(GEO_ACCESS_STATUSES as readonly string[]).includes(status)) return { error: "Neznan status." };
  await prisma.geoAccess.update({ where: { id: accessId }, data: { status, method: str(fd, "method", 300), note: str(fd, "note", 500) } });
  if (status !== a.status) await geoLog(a.clientId, user, "ACCESS", `${GEO_PLATFORM_LABEL[a.platform] || a.platform}: ${status}`);
  // Google access approved → the access task is done when all the main ones are settled.
  if (status === "APPROVED" && a.platform === "GOOGLE") {
    await prisma.geoTask.updateMany({
      where: { clientId: a.clientId, key: "access", status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] } },
      data: { status: "DONE", doneAt: new Date() },
    });
  }
  await advanceGeoClient(a.clientId, user);
  revalidateClient(a.clientId);
  return { success: "Shranjeno." };
}

export async function addAccess(clientId: string, platform: string): Promise<GeoResult> {
  const user = await requireUser();
  const c = await clientForWork(user, clientId);
  if (!c) return { error: "Ni dovoljeno." };
  if (!(GEO_PLATFORMS as readonly string[]).includes(platform)) return { error: "Neznana platforma." };
  await prisma.geoAccess.create({ data: { clientId, platform } });
  revalidateClient(clientId);
  return { success: "Dodano." };
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export async function updateGeoTask(taskId: string, status: string, note?: string | null): Promise<GeoResult> {
  const user = await requireUser();
  const t = await prisma.geoTask.findUnique({ where: { id: taskId } });
  if (!t) return { error: "Naloge ni mogoče najti." };
  const c = await clientForWork(user, t.clientId);
  if (!c && t.assigneeId !== user.id) return { error: "Ni dovoljeno." };
  if (!(GEO_TASK_STATUSES as readonly string[]).includes(status)) return { error: "Neznan status." };
  if (status === "NOT_POSSIBLE" && !note?.trim()) return { error: "Napišite, zakaj ni izvedljivo." };
  let final = status;
  // Anything public needs the admin's OK first.
  if (status === "DONE" && t.needsApproval && user.role !== "ADMIN") final = "WAITING_APPROVAL";
  if (status === "WAITING_APPROVAL" && user.role === "ADMIN") final = "DONE";
  await prisma.geoTask.update({
    where: { id: taskId },
    data: {
      status: final,
      note: note === undefined ? t.note : note?.trim() || null,
      waitingSince: final === "WAITING_CLIENT" ? t.waitingSince ?? new Date() : null,
      remindedAt: final === "WAITING_CLIENT" ? t.remindedAt : null,
      doneAt: final === "DONE" || final === "NOT_POSSIBLE" ? new Date() : null,
      approvedById: final === "DONE" && t.needsApproval ? user.id : t.approvedById,
    },
  });
  await geoLog(t.clientId, user, "TASK", `${t.title}: ${GEO_TASK_STATUS_LABEL[final]}${note?.trim() ? ` — ${note.trim()}` : ""}`);
  if (final === "WAITING_APPROVAL") {
    await notify(await geoAdmins(), {
      type: "GEO",
      title: `Čaka potrditev: ${c?.company || ""}`,
      body: t.title,
      link: "/admin/geo?view=approve",
    });
  }
  await advanceGeoClient(t.clientId, user);
  revalidateClient(t.clientId);
  return { success: final === "WAITING_APPROVAL" ? "Poslano v potrditev." : "Shranjeno." };
}

/** Admin: send an approval-pending task back with a comment. */
export async function returnGeoTask(taskId: string, note: string): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Samo administrator." };
  const t = await prisma.geoTask.findUnique({ where: { id: taskId }, include: { client: { select: { company: true } } } });
  if (!t) return { error: "Naloge ni mogoče najti." };
  await prisma.geoTask.update({ where: { id: taskId }, data: { status: "IN_PROGRESS", note: note.trim() || t.note } });
  await geoLog(t.clientId, user, "TASK", `${t.title}: vrnjeno v delo — ${note.trim()}`);
  await notify([t.assigneeId], {
    type: "GEO",
    title: `Popravek: ${t.client.company}`,
    body: `${t.title}: ${note.trim()}`,
    link: `/izvedba/stranke/${t.clientId}?tab=naloge`,
  });
  revalidateClient(t.clientId);
  return { success: "Vrnjeno asistentu." };
}

export async function addGeoTask(clientId: string, fd: FormData): Promise<GeoResult> {
  const user = await requireUser();
  const c = await clientForWork(user, clientId);
  if (!c) return { error: "Ni dovoljeno." };
  const title = str(fd, "title", 300);
  if (!title) return { error: "Vpišite naslov naloge." };
  const dueRaw = str(fd, "dueDate");
  await prisma.geoTask.create({
    data: {
      clientId,
      title,
      description: str(fd, "description"),
      phase: str(fd, "phase") && (GEO_PHASES as readonly string[]).includes(str(fd, "phase")!) ? str(fd, "phase")! : "MONTHLY",
      dueDate: dueRaw ? new Date(`${dueRaw}T09:00:00Z`) : null,
      assigneeId: c.assistantId ?? user.id,
      needsApproval: fd.get("needsApproval") === "on",
      technical: fd.get("technical") === "on",
    },
  });
  await geoLog(clientId, user, "TASK", `Nova naloga: ${title}`);
  revalidateClient(clientId);
  return { success: "Naloga dodana." };
}

// ─── Measurements ─────────────────────────────────────────────────────────

export async function saveMeasurement(clientId: string, fd: FormData): Promise<GeoResult> {
  const user = await requireUser();
  const c = await clientForWork(user, clientId);
  if (!c) return { error: "Ni dovoljeno." };
  const month = Math.max(0, Math.min(120, Number(fd.get("month") ?? 0) || 0));
  const answers = Math.round(num(fd, "answers") || 0) || null;
  const mentions = fd.get("mentions") !== null && String(fd.get("mentions")).trim() !== "" ? Math.max(0, Math.round(Number(fd.get("mentions")) || 0)) : null;
  let score = num(fd, "score");
  if (score === null && answers && mentions !== null) score = Math.round((mentions / answers) * 1000) / 10;
  const mapRanks = String(fd.get("mapRanks") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [query, rank] = l.split("|").map((x) => x.trim());
      const r = Number(rank);
      return { query, rank: Number.isFinite(r) && r > 0 ? r : null };
    });
  const wrongFacts = String(fd.get("wrongFacts") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  await prisma.geoMeasurement.create({
    data: {
      clientId,
      month,
      answers,
      mentions,
      score,
      mapRanks,
      wrongFacts,
      reportUrl: str(fd, "reportUrl", 500),
      note: str(fd, "note"),
      createdById: user.id,
    },
  });
  for (const f of wrongFacts) {
    await prisma.geoTask.create({
      data: {
        clientId,
        key: "wrong-fact",
        title: `Popravi napačen podatek: ${f.slice(0, 200)}`,
        phase: month === 0 ? "FIX" : "MONTHLY",
        dueDate: new Date(Date.now() + 7 * DAY),
        assigneeId: c.assistantId,
      },
    });
  }
  // Close the matching measurement task.
  await prisma.geoTask.updateMany({
    where: {
      clientId,
      status: { notIn: ["DONE", "NOT_POSSIBLE"] },
      key: month === 0 ? "baseline" : "measurement",
      ...(month === 0 ? {} : { dueDate: { lte: new Date(Date.now() + 10 * DAY) } }),
    },
    data: { status: "DONE", doneAt: new Date() },
  });
  await geoLog(clientId, user, "MEASUREMENT", `Mesec ${month}: ocena ${score ?? "—"} %${wrongFacts.length ? `, napačnih podatkov: ${wrongFacts.length}` : ""}`);
  await advanceGeoClient(clientId, user);
  revalidateClient(clientId);
  return { success: `Meritev shranjena.${wrongFacts.length ? ` Ustvarjenih nalog za popravke: ${wrongFacts.length}.` : ""}` };
}

// ─── Website check ────────────────────────────────────────────────────────

export async function verifyClientSite(clientId: string): Promise<GeoResult> {
  const user = await requireUser();
  const c = await clientForWork(user, clientId);
  if (!c) return { error: "Ni dovoljeno." };
  const card = asCard(c.card);
  if (!card.website) return { error: "V kartici ni spletne strani." };
  const result = await verifySite(card);
  await prisma.geoClient.update({ where: { id: clientId }, data: { lastCheck: result as any } });
  await geoLog(clientId, user, "SITE_CHECK", result.ok ? "Vse preverjeno — v redu." : `Težave: ${result.checks.filter((x) => !x.ok).map((x) => x.label).join(", ")}`);
  if (result.ok) {
    const open = await prisma.geoTask.findMany({
      where: { clientId, key: "website-code", status: { notIn: ["DONE", "NOT_POSSIBLE", "WAITING_APPROVAL"] } },
    });
    for (const t of open) {
      const final = t.needsApproval && user.role !== "ADMIN" ? "WAITING_APPROVAL" : "DONE";
      await prisma.geoTask.update({
        where: { id: t.id },
        data: { status: final, doneAt: final === "DONE" ? new Date() : null, note: `Samodejno preverjeno ${new Date().toLocaleDateString("sl-SI")}: vse v redu.` },
      });
    }
    if (open.length) await advanceGeoClient(clientId, user);
  }
  revalidateClient(clientId);
  return result.ok ? { success: "Stran je v redu — vse preverjeno." } : { error: "Stran še ni v redu — glej podrobnosti spodaj." };
}

// ─── Admin: task templates ────────────────────────────────────────────────

export async function saveGeoTemplate(fd: FormData): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Admins only." };
  const id = str(fd, "id");
  const title = str(fd, "title", 300);
  if (!title) return { error: "Title is required." };
  const packages = fd.getAll("packages").map(String).filter((p) => (GEO_TEMPLATE_GROUPS as readonly string[]).includes(p));
  if (!packages.length) return { error: "Pick at least one package or add-on." };
  const phase = str(fd, "phase") || "START";
  const recurrence = phase === "MONTHLY" ? "MONTHLY" : phase === "QUARTERLY" ? "QUARTERLY" : "ONCE";
  const data = {
    title,
    description: str(fd, "description", 4000),
    packages,
    phase: (GEO_PHASES as readonly string[]).includes(phase) ? phase : "START",
    recurrence,
    dueDay: Math.max(0, Math.min(365, Number(fd.get("dueDay") ?? 0) || 0)),
    needsApproval: fd.get("needsApproval") === "on",
    technical: fd.get("technical") === "on",
    active: fd.get("active") === "on",
    sortOrder: Number(fd.get("sortOrder") ?? 0) || 0,
  };
  if (id) await prisma.geoTaskTemplate.update({ where: { id }, data });
  else await prisma.geoTaskTemplate.create({ data });
  revalidatePath("/admin/geo/templates");
  return { success: "Saved. New clients get the updated tasks; recurring tasks change from the next month." };
}

export async function deleteGeoTemplate(id: string): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Admins only." };
  await prisma.geoTaskTemplate.delete({ where: { id } });
  revalidatePath("/admin/geo/templates");
  return { success: "Deleted." };
}

/** Admin: end of an Unbusyness pilot — the client continues as a paying customer, or the pilot ends. */
export async function closePilot(clientId: string, outcome: "CONVERTED" | "ENDED", note: string): Promise<GeoResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Samo administrator." };
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c || c.line !== "UNBUSYNESS") return { error: "Pilota ni mogoče najti." };
  const details = { ...((c.details as UnbDetails) || {}), outcome, outcomeNote: note.trim() || undefined };
  await prisma.geoClient.update({ where: { id: clientId }, data: { details: details as any, status: "DONE", statusAt: new Date() } });
  await prisma.geoTask.updateMany({
    where: { clientId, key: "pilot-review", status: { notIn: ["DONE", "NOT_POSSIBLE"] } },
    data: { status: "DONE", doneAt: new Date(), approvedById: user.id },
  });
  await geoLog(clientId, user, "PILOT_CLOSED", outcome === "CONVERTED" ? `Nadaljuje kot plačljiva stranka.${note ? ` ${note}` : ""}` : `Pilot končan brez nadaljevanja.${note ? ` ${note}` : ""}`);
  if (c.sellerId)
    await notify([c.sellerId], {
      type: "GEO",
      title: outcome === "CONVERTED" ? `Pilot uspešen: ${c.company} — pripravi ponudbo` : `Pilot končan: ${c.company}`,
      body: note.trim() || undefined,
      link: `/crm/customers/${c.customerId}`,
    });
  revalidateClient(clientId, c.customerId);
  return { success: outcome === "CONVERTED" ? "Pilot zaključen — prodajalec je obveščen, da pripravi ponudbo." : "Pilot zaključen." };
}

// ─── SimpleImport supplier offers ─────────────────────────────────────────

function offerData(fd: FormData) {
  const int = (k: string) => {
    const v = num(fd, k);
    return v === null ? null : Math.round(v);
  };
  const currency = str(fd, "currency", 3) || "USD";
  return {
    supplier: str(fd, "supplier", 160) || "",
    location: str(fd, "location", 120),
    contact: str(fd, "contact", 300),
    unitPrice: num(fd, "unitPrice"),
    currency: (IMPORT_CURRENCIES as readonly string[]).includes(currency) ? currency : "USD",
    moq: int("moq"),
    leadDays: int("leadDays"),
    incoterm: str(fd, "incoterm", 10),
    certificates: str(fd, "certificates", 300),
    sampleCost: num(fd, "sampleCost"),
    verified: fd.get("verified") === "on",
    note: str(fd, "note", 1000),
  };
}

export async function saveImportOffer(clientId: string, offerId: string | null, fd: FormData): Promise<GeoResult> {
  const user = await requireUser();
  const c = await clientForWork(user, clientId);
  if (!c || c.line !== "IMPORT") return { error: "Ni dovoljeno." };
  const data = offerData(fd);
  if (!data.supplier) return { error: "Vpiši ime dobavitelja." };
  if (offerId) {
    const o = await prisma.importOffer.findUnique({ where: { id: offerId } });
    if (!o || o.clientId !== clientId) return { error: "Ni najdeno." };
    await prisma.importOffer.update({ where: { id: offerId }, data });
  } else {
    await prisma.importOffer.create({ data: { ...data, clientId, createdById: user.id } });
    await geoLog(clientId, user, "OFFER", `Nova ponudba: ${data.supplier}`);
  }
  revalidateClient(clientId);
  return { success: "Shranjeno." };
}

export async function setImportOfferStatus(offerId: string, status: string): Promise<GeoResult> {
  const user = await requireUser();
  const o = await prisma.importOffer.findUnique({ where: { id: offerId } });
  if (!o) return { error: "Ni najdeno." };
  const c = await clientForWork(user, o.clientId);
  if (!c) return { error: "Ni dovoljeno." };
  if (!(IMPORT_OFFER_STATUSES as readonly string[]).includes(status)) return { error: "Neznan status." };
  await prisma.importOffer.update({ where: { id: offerId }, data: { status } });
  await geoLog(o.clientId, user, "OFFER", `${o.supplier}: ${IMPORT_OFFER_STATUS_LABEL[status]}`);
  revalidateClient(o.clientId);
  return { success: "Shranjeno." };
}

export async function deleteImportOffer(offerId: string): Promise<GeoResult> {
  const user = await requireUser();
  const o = await prisma.importOffer.findUnique({ where: { id: offerId } });
  if (!o) return { error: "Ni najdeno." };
  const c = await clientForWork(user, o.clientId);
  if (!c) return { error: "Ni dovoljeno." };
  await prisma.importOffer.delete({ where: { id: offerId } });
  await geoLog(o.clientId, user, "OFFER", `Ponudba izbrisana: ${o.supplier}`);
  revalidateClient(o.clientId);
  return { success: "Izbrisano." };
}
