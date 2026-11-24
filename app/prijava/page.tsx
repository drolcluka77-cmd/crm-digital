import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import ApplyForm from "./ApplyForm";
import { positionKey, positionOf } from "@/lib/recruiting-labels";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: { pozicija?: string } }): Promise<Metadata> {
  const pos = positionOf(searchParams.pozicija);
  return { title: `Prijava — ${pos.title}`, description: pos.intro.slice(0, 160) };
}

export default async function ApplyPage({ searchParams }: { searchParams: { vir?: string; pozicija?: string } }) {
  const settings = await getSettings();
  const key = positionKey(searchParams.pozicija);
  const pos = positionOf(key);
  const source =
    searchParams.vir === "studentski-servis" || searchParams.vir === "ss"
      ? "Študentski servis"
      : (searchParams.vir || "").slice(0, 60) || null;
  return (
    <div className="min-h-screen bg-sand-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.companyName} className="h-10 mb-4" />
          ) : (
            <div className="text-xs font-semibold tracking-[0.18em] uppercase text-brand-600 mb-2">{settings.companyName}</div>
          )}
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{pos.title}</h1>
          <p className="text-black/60 mt-2 leading-relaxed">{pos.intro}</p>
          <p className="text-black/60 mt-2">
            {pos.autoInvite === false
              ? "Izpolnite obrazec — prijave pregledamo in izbrane kandidate povabimo na kratek uvodni pogovor."
              : "Izpolnite obrazec — povabilo na kratek uvodni pogovor prejmete takoj po e-pošti."}
          </p>
        </div>
        <ApplyForm position={key} experienceLabel={pos.experienceLabel} experienceHint={pos.experienceHint} source={source} retentionMonths={settings.recruitingRetentionMonths} companyName={settings.companyName} questions={pos.questions} autoInvite={pos.autoInvite !== false} />
      </div>
    </div>
  );
}
