"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import { hashCode, newSigningCode } from "@/lib/contracts";
import { completeSigning } from "@/lib/contract-signing";

export type SignResult = { error?: string; sentTo?: string; done?: boolean } | void;

async function openContract(token: string) {
  const c = await prisma.contract.findUnique({ where: { publicToken: token } });
  if (!c || c.status === "CANCELLED") return { error: "Ta povezava ni več veljavna." } as const;
  if (c.status === "SIGNED") return { error: "Pogodba je že podpisana." } as const;
  if (c.status !== "SENT") return { error: "Pogodba še ni pripravljena za podpis." } as const;
  return { c } as const;
}

const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2");

/** Sends a 6-digit code to the client's e-mail on the contract. */
export async function requestSigningCode(token: string): Promise<SignResult> {
  const o = await openContract(token);
  if ("error" in o) return { error: o.error };
  const c = o.c;
  if (!c.clientEmail) return { error: "Na pogodbi ni e-naslova. Obrnite se na svojega skrbnika." };
  // At most one code a minute.
  if (c.codeExpiresAt && c.codeExpiresAt.getTime() - 14 * 60_000 > Date.now()) {
    return { error: "Koda je bila pravkar poslana. Preverite e-pošto (tudi mapo z vsiljeno pošto)." };
  }
  const code = newSigningCode();
  await prisma.contract.update({
    where: { id: c.id },
    data: { codeHash: hashCode(c.id, code), codeExpiresAt: new Date(Date.now() + 15 * 60_000), codeAttempts: 0 },
  });
  const s = await getSettings();
  try {
    await sendEmail({
      to: c.clientEmail,
      subject: `Koda za podpis pogodbe ${c.number}: ${code}`,
      text: `Vaša koda za elektronski podpis pogodbe ${c.number} je: ${code}\n\nKoda velja 15 minut. Če pogodbe ne podpisujete vi, to sporočilo prezrite.\n\n${s.legalName}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2430">Vaša koda za elektronski podpis pogodbe ${c.number} je:<div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:14px 0">${code}</div>Koda velja 15 minut. Če pogodbe ne podpisujete vi, to sporočilo prezrite.<br><br>${s.legalName}</div>`,
    });
  } catch {
    return { error: "Kode ni bilo mogoče poslati. Poskusite znova čez minuto." };
  }
  return { sentTo: mask(c.clientEmail) };
}

export async function signContract(token: string, fd: FormData): Promise<SignResult> {
  const o = await openContract(token);
  if ("error" in o) return { error: o.error };
  const c = o.c;
  const name = String(fd.get("name") || "").trim().slice(0, 120);
  const title = String(fd.get("title") || "").trim().slice(0, 120) || null;
  const code = String(fd.get("code") || "").replace(/\D/g, "");
  if (name.length < 3) return { error: "Vpišite svoje ime in priimek." };
  if (fd.get("agree") !== "on") return { error: "Potrdite, da ste pogodbo prebrali in se z njo strinjate." };
  if (!c.codeHash || !c.codeExpiresAt) return { error: "Najprej zahtevajte kodo." };
  if (c.codeExpiresAt < new Date()) return { error: "Koda je potekla. Zahtevajte novo." };
  if (c.codeAttempts >= 5) return { error: "Preveč napačnih poskusov. Zahtevajte novo kodo." };
  if (hashCode(c.id, code) !== c.codeHash) {
    await prisma.contract.update({ where: { id: c.id }, data: { codeAttempts: { increment: 1 } } });
    return { error: "Koda ni pravilna." };
  }
  // Claim the signing (guards against a double click).
  const { count } = await prisma.contract.updateMany({ where: { id: c.id, status: "SENT", codeHash: c.codeHash }, data: { codeHash: null } });
  if (count === 0) return { error: "Pogodba je že v podpisu. Osvežite stran." };
  const h = headers();
  await completeSigning(c.id, {
    name,
    title,
    ip: (h.get("x-forwarded-for") || "").split(",")[0].trim() || null,
    userAgent: h.get("user-agent"),
  });
  return { done: true };
}
