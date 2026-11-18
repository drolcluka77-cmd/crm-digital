import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prijava — prodaja digitalnih produktov",
  description: "Prijavite se za delo pri prodaji digitalnih produktov.",
};

export default async function ApplyPage({ searchParams }: { searchParams: { vir?: string } }) {
  const settings = await getSettings();
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
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Prodaja digitalnih produktov</h1>
          <p className="text-black/60 mt-2 leading-relaxed">
            Iščemo prodajalce, ki bodo podjetjem v Sloveniji predstavljali sodobne digitalne rešitve — Unbusyness in
            Picked. Dobite prodajne liste, scenarije klicev in CRM s priporočenimi kontakti. Delo od doma ali v
            Ljubljani.
          </p>
          <p className="text-black/60 mt-2">Izpolnite obrazec — povabilo na kratek uvodni pogovor prejmete takoj po e-pošti.</p>
        </div>
        <ApplyForm source={source} retentionMonths={settings.recruitingRetentionMonths} companyName={settings.companyName} />
      </div>
    </div>
  );
}
