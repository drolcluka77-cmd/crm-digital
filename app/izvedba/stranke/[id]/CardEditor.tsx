"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCard } from "@/lib/geo-actions";
import {
  DAY_LABELS,
  GEO_LANGUAGES,
  SITE_PLATFORMS,
  SITE_PLATFORM_LABEL,
  emptyHours,
  type CardFaq,
  type CardHoliday,
  type CardService,
  type GeoCard,
} from "@/lib/geo-labels";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="font-semibold">{title}</div>
      {hint && <p className="text-xs text-black/45 mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </div>
  );
}
function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
const toLines = (a?: string[]) => (a || []).join("\n");
const fromLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function CardEditor({
  clientId,
  card: initial,
  pkg,
  industry,
  missing,
  updated,
}: {
  clientId: string;
  card: GeoCard;
  pkg: string | null;
  industry: string | null;
  missing: string[];
  updated: string | null;
}) {
  const router = useRouter();
  const [card, setCard] = useState<GeoCard>({
    country: "SI",
    ...initial,
    hours: initial.hours?.length === 7 ? initial.hours : emptyHours(),
    services: initial.services?.length ? initial.services : [{ name: "", description: "", price: "" }],
    faqs: initial.faqs || [],
    holidays: initial.holidays || [],
    profiles: initial.profiles || {},
  });
  const [lists, setLists] = useState({
    aiQuestions: toLines(initial.aiQuestions),
    keySearches: toLines(initial.keySearches),
    competitors: toLines(initial.competitors),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof GeoCard>(k: K, v: GeoCard[K]) => {
    setCard((c) => ({ ...c, [k]: v }));
    setDirty(true);
  };
  const inp = (k: keyof GeoCard, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className="input" value={(card[k] as string) || ""} onChange={(e) => set(k, e.target.value as any)} {...props} />
  );
  const needQ = pkg === "RECOMMENDED" || pkg === "CONCIERGE" ? 50 : 30;
  const count = (s: string) => fromLines(s).length;

  async function save() {
    setBusy(true);
    setMsg(null);
    const full: GeoCard = {
      ...card,
      services: (card.services || []).filter((s) => s.name?.trim()),
      faqs: (card.faqs || []).filter((f) => f.q?.trim() && f.a?.trim()),
      holidays: (card.holidays || []).filter((h) => h.date),
      aiQuestions: fromLines(lists.aiQuestions),
      keySearches: fromLines(lists.keySearches),
      competitors: fromLines(lists.competitors),
    };
    const r = await saveCard(clientId, JSON.stringify(full));
    setBusy(false);
    setMsg(r || null);
    if (r && !r.error) {
      setDirty(false);
      router.refresh();
    }
  }

  const services = card.services || [];
  const faqs = card.faqs || [];
  const holidays = card.holidays || [];

  return (
    <div className="space-y-5 pb-24">
      {missing.length > 0 ? (
        <div className="card p-4 border-amber-200 bg-amber-50/60 text-sm">
          <b>Za naslednji korak manjka:</b> {missing.join(", ")}.
        </div>
      ) : (
        <div className="success-box text-sm">Kartica je popolna.</div>
      )}
      <p className="text-xs text-black/45">
        Kartica je edini vir podatkov: iz nje se sestavi koda za spletno stran, enaki podatki gredo na vse platforme. Ko spremeniš
        delovni čas, naslov ali telefon, CRM ustvari naloge za posodobitev na vseh platformah z odobrenim dostopom.
        {updated ? ` Zadnja sprememba: ${updated}.` : ""}
      </p>

      <Section title="Osnovni podatki (enako povsod)" hint="Ime, naslov in telefon zapiši natančno tako, kot naj bodo povsod — tudi presledki in okrajšave.">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Uradno ime *">{inp("legalName")}</F>
          <F label="Telefon *">{inp("phone", { placeholder: "+386 1 234 56 78" })}</F>
          <F label="Naslov (ulica in hišna številka) *">{inp("address")}</F>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <F label="Pošta">{inp("postalCode", { placeholder: "1000" })}</F>
            <F label="Kraj *">{inp("city")}</F>
          </div>
          <F label="E-pošta">{inp("email")}</F>
          <F label="Spletna stran">{inp("website", { placeholder: "https://…" })}</F>
          <F label="Na čem je spletna stran *">
            <select className="input" value={card.sitePlatform || ""} onChange={(e) => set("sitePlatform", e.target.value)}>
              <option value="">Izberi …</option>
              {SITE_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {SITE_PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </F>
          <div className="text-sm">
            <span className="label">Jeziki spletne strani</span>
            <div className="flex flex-wrap gap-3 mt-2">
              {GEO_LANGUAGES.map((l) => (
                <label key={l} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={(card.siteLanguages || []).includes(l)}
                    onChange={(e) =>
                      set("siteLanguages", e.target.checked ? [...(card.siteLanguages || []), l] : (card.siteLanguages || []).filter((x) => x !== l))
                    }
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <F label="Koordinate (prilepi iz Google Zemljevidov: desni klik → številke)" wide>
            <input
              className="input"
              value={card.lat && card.lng ? `${card.lat}, ${card.lng}` : card.lat || ""}
              onChange={(e) => {
                const [la, ln] = e.target.value.split(/[,;\s]+/).filter(Boolean);
                setCard((c) => ({ ...c, lat: la || "", lng: ln || "" }));
                setDirty(true);
              }}
              placeholder="46.0569, 14.5058"
            />
          </F>
        </div>
      </Section>

      <Section title="Delovni čas *">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={!!card.open24h} onChange={(e) => set("open24h", e.target.checked)} /> Odprto 24/7
        </label>
        {!card.open24h && (
          <div className="space-y-2">
            {(card.hours || []).map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24">{DAY_LABELS[i]}</span>
                <label className="flex items-center gap-1.5 w-24">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) => set("hours", (card.hours || []).map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))}
                  />
                  zaprto
                </label>
                {!h.closed && (
                  <>
                    {(["open", "close", "open2", "close2"] as const).map((k) => (
                      <input
                        key={k}
                        type="time"
                        className="input w-[110px] py-1.5"
                        value={(h as any)[k] || ""}
                        title={k.endsWith("2") ? "Drugi del dneva (npr. po odmoru) — neobvezno" : undefined}
                        onChange={(e) => set("hours", (card.hours || []).map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                      />
                    ))}
                    {i === 0 && (
                      <button
                        type="button"
                        className="text-xs text-brand-600"
                        onClick={() => set("hours", (card.hours || []).map((x, j) => (j > 0 && j < 5 ? { ...h } : x)))}
                      >
                        kopiraj na tor–pet
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
            <p className="text-xs text-black/40">Drugi par ur je za deljen delovni čas (npr. 8–12 in 14–18).</p>
          </div>
        )}
        <div className="mt-4">
          <div className="label">Prazniki in izjeme</div>
          {holidays.map((h: CardHoliday, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm mb-2">
              <input
                type="date"
                className="input w-[160px] py-1.5"
                value={h.date}
                onChange={(e) => set("holidays", holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={h.closed} onChange={(e) => set("holidays", holidays.map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))} />
                zaprto
              </label>
              {!h.closed &&
                (["open", "close"] as const).map((k) => (
                  <input
                    key={k}
                    type="time"
                    className="input w-[110px] py-1.5"
                    value={h[k] || ""}
                    onChange={(e) => set("holidays", holidays.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                  />
                ))}
              <input
                className="input w-[200px] py-1.5"
                placeholder="npr. Božič"
                value={h.note || ""}
                onChange={(e) => set("holidays", holidays.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
              />
              <button type="button" className="text-xs text-rose-600" onClick={() => set("holidays", holidays.filter((_, j) => j !== i))}>
                odstrani
              </button>
            </div>
          ))}
          <button type="button" className="text-sm text-brand-600" onClick={() => set("holidays", [...holidays, { date: "", closed: true }])}>
            + dodaj praznik ali izjemo
          </button>
        </div>
      </Section>

      <Section title="Kategorije in opis">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Glavna kategorija * (kot v Google profilu)">{inp("primaryCategory", { placeholder: "npr. Zobozdravnik, Avtovleka, Italijanska restavracija" })}</F>
          <F label="Dodatne kategorije">{inp("extraCategories", { placeholder: "ločene z vejico" })}</F>
          <F label="Cenovni razred">
            <select className="input" value={card.priceRange || ""} onChange={(e) => set("priceRange", e.target.value)}>
              <option value="">—</option>
              {["€", "€€", "€€€", "€€€€"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </F>
          <F label="Tip schema.org (samo če samodejni ni pravi)">{inp("schemaType", { placeholder: "samodejno iz panoge in kategorije" })}</F>
          <F label={`Kratek opis podjetja * (${(card.description || "").length}/750)`} wide>
            <textarea
              className="input"
              rows={4}
              maxLength={750}
              value={card.description || ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Prvi stavek naj pove, kaj podjetje dela in kje. Nato posebnosti, za koga, od kdaj."
            />
          </F>
        </div>
      </Section>

      <Section title="Storitve oz. meni s cenami *" hint="Ena vrstica na storitev. Ceno zapiši kot številko (npr. 45) ali besedilo (npr. od 45 €, po dogovoru).">
        <div className="space-y-2">
          {services.map((s: CardService, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_2fr_130px_auto] gap-2">
              <input className="input py-1.5" placeholder="Storitev" value={s.name} onChange={(e) => set("services", services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input py-1.5" placeholder="Kratek opis" value={s.description || ""} onChange={(e) => set("services", services.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input className="input py-1.5" placeholder="Cena" value={s.price || ""} onChange={(e) => set("services", services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <button type="button" className="text-xs text-rose-600 px-2" onClick={() => set("services", services.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="text-sm text-brand-600 mt-2" onClick={() => set("services", [...services, { name: "", description: "", price: "" }])}>
          + dodaj storitev
        </button>
      </Section>

      <Section title="Pogosta vprašanja strank" hint="Vprašanja, ki jih stranke res sprašujejo (po telefonu, v ocenah). Odgovor naj bo kratek in konkreten.">
        <div className="space-y-3">
          {faqs.map((f: CardFaq, i) => (
            <div key={i} className="grid gap-2">
              <div className="flex gap-2">
                <input className="input py-1.5" placeholder="Vprašanje" value={f.q} onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                <button type="button" className="text-xs text-rose-600 px-2" onClick={() => set("faqs", faqs.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
              <textarea className="input py-1.5" rows={2} placeholder="Odgovor" value={f.a} onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </div>
          ))}
        </div>
        <button type="button" className="text-sm text-brand-600 mt-2" onClick={() => set("faqs", [...faqs, { q: "", a: "" }])}>
          + dodaj vprašanje
        </button>
      </Section>

      <Section title="Fotografije in povezave" hint="Povezave na profile so v kodi »sameAs« — AI z njimi potrdi, da gre za isto podjetje.">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Mapa s fotografijami * (Google Drive, Dropbox …)">{inp("photosUrl")}</F>
          <F label="Število fotografij v mapi * (najmanj 10)">
            <input type="number" min={0} className="input" value={card.photosCount ?? ""} onChange={(e) => set("photosCount", Number(e.target.value) || 0)} />
          </F>
          <F label="Logotip (javna povezava do slike)">{inp("logoUrl")}</F>
          <F label="Naslovna fotografija (javna povezava)">{inp("imageUrl")}</F>
          {(["google", "facebook", "instagram", "tripadvisor", "booking", "linkedin", "other"] as const).map((k) => (
            <F key={k} label={{ google: "Google profil (povezava na Zemljevide)", facebook: "Facebook", instagram: "Instagram", tripadvisor: "TripAdvisor", booking: "Booking.com", linkedin: "LinkedIn", other: "Drug profil" }[k]}>
              <input className="input" value={card.profiles?.[k] || ""} onChange={(e) => set("profiles", { ...(card.profiles || {}), [k]: e.target.value })} />
            </F>
          ))}
        </div>
      </Section>

      {industry && industry !== "OTHER" && industry !== "INSURANCE" ? (
        <Section title="Posebnosti panoge">
          <div className="grid sm:grid-cols-2 gap-4">
            {industry === "RESTAURANT" && (
              <>
                <F label="Vrsta kuhinje">{inp("cuisine", { placeholder: "npr. italijanska, morska hrana" })}</F>
                <F label="Povezava do menija">{inp("menuUrl")}</F>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!card.acceptsReservations} onChange={(e) => set("acceptsReservations", e.target.checked)} /> Sprejemajo rezervacije
                </label>
              </>
            )}
            {industry === "LODGING" && (
              <>
                <F label="Prijava (od)">{inp("checkin", { type: "time" })}</F>
                <F label="Odjava (do)">{inp("checkout", { type: "time" })}</F>
                <F label="Oprema (ločeno z vejico)" wide>
                  {inp("amenities", { placeholder: "brezplačno parkiranje, Wi-Fi, klima, zajtrk" })}
                </F>
              </>
            )}
            {["TOWING", "TRADES", "CAR_REPAIR", "ACTIVITIES"].includes(industry) && (
              <F label="Območje, ki ga pokrivajo (kraji, ločeno z vejico)" wide>
                {inp("areaServed", { placeholder: "Ljubljana, Kamnik, Domžale" })}
              </F>
            )}
            {industry === "DENTAL" && (
              <F label="Specializacije (ločeno z vejico)" wide>
                {inp("specialties", { placeholder: "npr. implantologija, ortodontija" })}
              </F>
            )}
          </div>
        </Section>
      ) : industry === "INSURANCE" ? (
        <Section title="Posebnosti panoge">
          <F label="Vrste zavarovanj (ločeno z vejico)">{inp("insuranceTypes", { placeholder: "avtomobilsko, nepremičninsko, življenjsko" })}</F>
        </Section>
      ) : null}

      <Section title="Merjenje" hint="Ista vprašanja in iskanja uporabljamo vsak mesec, zato jih po izhodišču ne spreminjaj.">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label={`Ključna iskanja za Zemljevide * (${count(lists.keySearches)}/10, eno na vrstico)`}>
            <textarea
              className="input font-mono text-[13px]"
              rows={10}
              value={lists.keySearches}
              onChange={(e) => {
                setLists((l) => ({ ...l, keySearches: e.target.value }));
                setDirty(true);
              }}
              placeholder={"avtovleka kamnik\nvlečna služba ljubljana"}
            />
          </F>
          <F label="Konkurenti (2–3, eno na vrstico)">
            <textarea
              className="input"
              rows={3}
              value={lists.competitors}
              onChange={(e) => {
                setLists((l) => ({ ...l, competitors: e.target.value }));
                setDirty(true);
              }}
            />
          </F>
          <F label={`AI vprašanja * (${count(lists.aiQuestions)}/${needQ}, eno na vrstico, v jezikih strank)`} wide>
            <textarea
              className="input font-mono text-[13px]"
              rows={12}
              value={lists.aiQuestions}
              onChange={(e) => {
                setLists((l) => ({ ...l, aiQuestions: e.target.value }));
                setDirty(true);
              }}
              placeholder={"Kdo mi lahko nocoj odvleče avto pri Kamniku?\nNajboljša avtovleka v okolici Ljubljane\nTowing service near Ljubljana open now"}
            />
          </F>
        </div>
      </Section>

      <div className="fixed bottom-0 inset-x-0 lg:left-64 bg-white/95 border-t border-black/10 px-4 py-3 z-20">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Shranjujem …" : "Shrani kartico"}
          </button>
          {dirty && <span className="text-sm text-amber-700">Neshranjene spremembe</span>}
          {msg?.error && <span className="text-sm text-rose-600">{msg.error}</span>}
          {msg?.success && !dirty && <span className="text-sm text-emerald-700">{msg.success}</span>}
        </div>
      </div>
    </div>
  );
}
