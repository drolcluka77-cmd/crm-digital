// Shared by server and client components (no server imports here).
export const CANDIDATE_STAGES = ["NEW", "INVITED", "BOOKED", "INTERVIEWED", "ONBOARDING", "HIRED", "REJECTED"] as const;
export const CANDIDATE_STAGE_LABEL: Record<string, string> = {
  NEW: "New",
  INVITED: "Invited",
  BOOKED: "Meeting booked",
  INTERVIEWED: "Interviewed",
  ONBOARDING: "Onboarding",
  HIRED: "Hired",
  REJECTED: "Not selected",
};
export const OPEN_CANDIDATE_STAGES = ["NEW", "INVITED", "BOOKED", "INTERVIEWED", "ONBOARDING"];

/** "Not selected" e-mail. {{firstName}}, {{senderName}} and {{company}} are filled in when sending. */
export const DEFAULT_REJECT_SUBJECT = "Vaša prijava za delo pri {{company}}";
export const DEFAULT_REJECT_BODY = `Pozdravljeni {{firstName}},

najlepša hvala za vaš čas, prijeten pogovor in zanimanje za delo pri nas.

Po skrbnem premisleku smo se na tej stopnji odločili za druge kandidate. Odločitev ni bila lahka, saj je bilo prijav veliko in so bile dobre.

Vaša prijava nam je ostala v lepem spominu, zato bi vas z veseljem kontaktirali, ko se bo spet odprlo podobno delovno mesto. Vaše podatke hranimo največ 6 mesecev; če ne želite, da vas kontaktiramo, nam preprosto odgovorite na to sporočilo in jih izbrišemo.

Želimo vam veliko uspeha pri študiju in na nadaljnji poti.

Lep pozdrav,
{{senderName}}
{{company}}`;

/** Open positions. The form link takes ?pozicija=<key>; each position has its own page text and invitation. */
export type RecruitingPosition = {
  label: string; // admin label
  title: string; // form page heading
  intro: string; // form page text
  experienceLabel: string;
  experienceHint: string;
  inviteSubject: string | null; // null = the invitation from Recruiting → Settings
  inviteBody: string | null;
};

export const DEFAULT_POSITION = "sales";

export const RECRUITING_POSITIONS: Record<string, RecruitingPosition> = {
  sales: {
    label: "Sales (GEO calls)",
    title: "Prodaja digitalnih produktov",
    intro:
      "Iščemo prodajalce, ki bodo podjetjem v Sloveniji predstavljali sodobne digitalne rešitve — Unbusyness in Picked. Dobite prodajne liste, scenarije klicev in CRM s priporočenimi kontakti. Delo od doma ali v Ljubljani.",
    experienceLabel: "Izkušnje s prodajo ali delom s strankami",
    experienceHint: "Na kratko — izkušnje niso pogoj.",
    inviteSubject: null,
    inviteBody: null,
  },
  "geo-asistent": {
    label: "Google & AI visibility assistant",
    title: "Asistent/ka za Google profile in AI vidnost podjetij",
    intro:
      "Mr. Picked pomaga lokalnim podjetjem (restavracije, hoteli, avtoservisi …), da jih najdejo Google in AI asistenti, kot sta ChatGPT in Gemini. Iščemo natančno in samostojno osebo, ki bo urejala Google profile in vpise podjetij, pripravljala objave in mesečna poročila. Delo od doma, prilagodljiv urnik, uvajanje zagotovljeno. Obseg: do 60 ur na mesec. Plačilo: 10 €/uro neto.",
    experienceLabel: "Izkušnje z Googlovimi orodji, družbenimi omrežji ali marketingom",
    experienceHint: "Npr. urejanje Google profila, Instagram strani, spletne strani, študij marketinga — izkušnje niso pogoj.",
    inviteSubject: "Povabilo na uvodni pogovor — asistent/ka za Google profile in AI vidnost",
    inviteBody: `Pozdravljeni {{firstName}},

hvala za vašo prijavo na delo asistenta/ke za Google profile in AI vidnost podjetij.

Mr. Picked (mrpicked.eu) pomaga lokalnim podjetjem — restavracijam, hotelom, avtoservisom in drugim —, da jih najdejo Google in AI asistenti, kot sta ChatGPT in Gemini.

Kaj boste delali:
• urejali Google profile podjetij (opisi, kategorije, fotografije, delovni čas),
• urejali vpise na platformah (Bing, Apple Maps, imeniki),
• pripravljali in objavljali objave na Google profilih,
• preverjali, kaj AI orodja povedo o podjetjih, in pripravljali mesečna poročila.

Delo je od doma, urnik je prilagodljiv, na začetku vas uvedemo v delo. Obseg je do 60 ur na mesec, plačilo 10 € na uro neto (prek študentskega servisa).

Naslednji korak je kratek uvodni pogovor (video klic). Predstavimo vam delo podrobneje in odgovorimo na vaša vprašanja. Termin, ki vam ustreza, izberite tukaj:
{{calendlyLink}}
POMEMBNO: termini so po slovenskem času (CET). Preden potrdite termin, na strani za rezervacijo preverite, da je pod koledarjem izbran časovni pas »Central European Time«. Če je izbran drug pas (npr. UK), bo ura sestanka drugačna od tiste, ki ste jo izbrali.

Če imate vprašanja, preprosto odgovorite na to sporočilo.

Lep pozdrav,
Luka Drolc
Mr. Picked · AURELIA GROUP d.o.o.`,
  },
};

export function positionOf(key: string | null | undefined): RecruitingPosition {
  return RECRUITING_POSITIONS[key || DEFAULT_POSITION] || RECRUITING_POSITIONS[DEFAULT_POSITION];
}
export function positionKey(key: string | null | undefined): string {
  return key && RECRUITING_POSITIONS[key] ? key : DEFAULT_POSITION;
}
