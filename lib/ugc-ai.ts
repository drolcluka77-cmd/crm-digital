import { prisma } from "@/lib/prisma";

/**
 * Weekly UGC ideas: for every active product, Claude suggests 3 short-video
 * ideas tied to the current theme (season, holidays, news in Slovenia).
 * They are saved as DRAFT tasks for the sales manager to edit and publish.
 * Needs ANTHROPIC_API_KEY (optional ANTHROPIC_MODEL).
 */

export function mondayOf(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

type Idea = { title: string; brief: string; theme?: string };

async function ask(prompt: string): Promise<Idea[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI is not set up: add ANTHROPIC_API_KEY to the server's variables.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 1800,
        system:
          "You plan short-form UGC videos (Instagram Reels / TikTok, 15–45 s) for a Slovenian software product. " +
          "Creators are students filming with a phone: one person talking to camera plus screen recordings of the app. " +
          "Write in Slovenian. Be concrete: a strong hook for the first 2 seconds, what to show, and a call to action " +
          "(link in bio and their personal code for the first month free). No made-up statistics, no claims about competitors, " +
          "no customer names. Answer with one JSON object only.",
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text = (json.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    const ideas: Idea[] = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
    return ideas
      .filter((i) => i && typeof i.title === "string")
      .slice(0, 3)
      .map((i) => ({
        title: String(i.title).slice(0, 140),
        brief: String(i.brief || "").slice(0, 2000),
        theme: i.theme ? String(i.theme).slice(0, 80) : undefined,
      }));
  } finally {
    clearTimeout(timer);
  }
}

/** Creates up to 3 draft ideas per active product for this week. */
export async function generateWeeklyIdeas(opts: { createdById?: string | null; productIds?: string[] } = {}) {
  const products = await prisma.product.findMany({
    where: { active: true, ...(opts.productIds ? { id: { in: opts.productIds } } : {}) },
    orderBy: { sortOrder: "asc" },
  });
  const week = mondayOf();
  const today = new Date().toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let created = 0;
  const errors: string[] = [];

  for (const p of products) {
    const recent = await prisma.ugcTask.findMany({
      where: { productId: p.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { title: true },
    });
    const prompt = `Danes je ${today}. Pripravi 3 ideje za kratke UGC videe za izdelek:

Ime: ${p.name}
${p.tagline ? `Slogan: ${p.tagline}\n` : ""}${p.targetSegment ? `Za koga: ${p.targetSegment}\n` : ""}${p.pitch ? `Pitch: ${p.pitch}\n` : ""}${p.keyBenefits ? `Ključne koristi:\n${p.keyBenefits}\n` : ""}${p.description ? `Opis: ${p.description.slice(0, 800)}\n` : ""}
Ideje naj izhajajo iz trenutne teme: letni čas, prazniki in dogodki ta in naslednji teden v Sloveniji ter aktualne novice, ki zadevajo to ciljno skupino (po potrebi poišči na spletu). Vsaka ideja naj ima drug pristop (npr. problem → rešitev, »dan v življenju«, hiter nasvet).
${recent.length ? `Ne ponavljaj teh že uporabljenih idej: ${recent.map((r) => r.title).join("; ")}\n` : ""}
Vrni JSON: {"ideas":[{"title":"kratek naslov","theme":"tema, npr. božič","brief":"Hook (prvi 2 s): …\\nKaj pokazati: …\\nZaključek / CTA: …"}]}`;
    try {
      const ideas = await ask(prompt);
      for (const i of ideas) {
        await prisma.ugcTask.create({
          data: {
            productId: p.id,
            title: i.title,
            brief: i.brief,
            theme: i.theme || null,
            weekOf: week,
            status: "DRAFT",
            ai: true,
            createdById: opts.createdById || null,
          },
        });
        created++;
      }
    } catch (e: any) {
      errors.push(`${p.name}: ${e?.message || "failed"}`);
      if (String(e?.message || "").includes("not set up")) break;
    }
  }
  return { created, errors };
}
