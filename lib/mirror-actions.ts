"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { runMirror, type MirrorKind, type MirrorSummary } from "@/lib/ai-mirror";
import { saveMeasurement } from "@/lib/geo-actions";
import { asCard } from "@/lib/geo";

const s = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Start a run from the form (seller or delivery). Returns the run id; the run itself takes 20 s – 1 min. */
export async function startMirror(fd: FormData): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  const kind: MirrorKind = s(fd, "kind") === "FULL" ? "FULL" : "QUICK";
  const customerId = s(fd, "customerId", 40) || null;
  const geoClientId = s(fd, "geoClientId", 40) || null;
  let company = s(fd, "company", 120);
  let city = s(fd, "city", 80);
  let category = s(fd, "category", 80);
  let website = s(fd, "website", 200) || null;
  let phone = s(fd, "phone", 40) || null;
  let address = s(fd, "address", 200) || null;
  let extraQueries = s(fd, "queries", 1500)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { ownerId: true } });
    if (!c) return { error: "Stranka ne obstaja." };
    if (user.role === "SALES" && c.ownerId !== user.id) return { error: "To ni vaša stranka." };
  }
  if (geoClientId) {
    const g = await prisma.geoClient.findUnique({ where: { id: geoClientId } });
    if (!g) return { error: "Stranka ne obstaja." };
    const staff = user.role === "ADMIN" || user.role === "MANAGER";
    if (!staff && g.assistantId !== user.id) return { error: "Ni dovoljeno." };
    // Delivery: the company card is the source of truth.
    const card = asCard(g.card);
    company = company || g.company;
    city = city || card.city || "";
    website = website || card.website || null;
    phone = phone || card.phone || null;
    address = address || [card.address, card.postalCode, card.city].filter(Boolean).join(", ") || null;
    category = category || card.primaryCategory || "";
    if (!extraQueries.length) extraQueries = [...(card.aiQuestions || []), ...(card.keySearches || [])].filter(Boolean);
  }
  if (!company || !city || !category) return { error: "Vpišite ime podjetja, kraj in dejavnost." };

  try {
    const id = await runMirror({ kind, company, city, category, website, phone, address, extraQueries, customerId, geoClientId }, user);
    if (customerId) revalidatePath(`/crm/customers/${customerId}`);
    revalidatePath("/crm/mirror");
    return { id };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

/** Mr. Picked: store a finished FULL run as the client's measurement for a month (creates fix tasks for wrong facts). */
export async function saveMirrorAsMeasurement(runId: string, month: number, mapRanks = ""): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const r = await prisma.aiMirrorRun.findUnique({ where: { id: runId } });
  if (!r || r.status !== "DONE" || !r.geoClientId) return { error: "Analiza ni najdena." };
  if (r.measurementId) return { error: "Ta analiza je že shranjena kot meritev." };
  const g = await prisma.geoClient.findUnique({ where: { id: r.geoClientId } });
  if (!g) return { error: "Stranka ne obstaja." };
  if (!(user.role === "ADMIN" || user.role === "MANAGER") && g.assistantId !== user.id) return { error: "Ni dovoljeno." };
  const sum = (r.summary as unknown as MirrorSummary) || ({} as MirrorSummary);
  const fd = new FormData();
  fd.set("month", String(Math.max(0, Math.round(month))));
  fd.set("answers", String(r.answersCount ?? 0));
  fd.set("mentions", String(r.mentions ?? 0));
  if (r.score !== null) fd.set("score", String(r.score));
  fd.set("mapRanks", String(mapRanks || "").slice(0, 2000));
  fd.set("wrongFacts", (sum.wrongFacts || []).join("\n"));
  fd.set("note", `AI Mirror (${new Date(r.createdAt).toLocaleDateString("sl-SI")}): ChatGPT + Gemini, ${r.answersCount ?? 0} odgovorov.`);
  const res = await saveMeasurement(g.id, fd);
  if (res?.error) return res;
  const m = await prisma.geoMeasurement.findFirst({ where: { clientId: g.id }, orderBy: { createdAt: "desc" } });
  await prisma.aiMirrorRun.update({ where: { id: runId }, data: { measurementId: m?.id ?? "saved" } });
  revalidatePath(`/izvedba/mirror/${runId}`);
  return { success: "Shranjeno kot meritev." };
}
