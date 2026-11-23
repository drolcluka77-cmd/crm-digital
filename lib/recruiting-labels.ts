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
