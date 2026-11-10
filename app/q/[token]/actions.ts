"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { acceptQuote, rejectQuote } from "@/lib/quotes";

export type PublicResult = { error?: string; done?: "accepted" | "declined" } | void;

async function loadOpenQuote(token: string) {
  const quote = await prisma.quote.findUnique({ where: { publicToken: token } });
  if (!quote) return { error: "This link is no longer valid." } as const;
  if (quote.status === "ACCEPTED" || quote.status === "REJECTED") {
    return { error: "This quote has already been answered." } as const;
  }
  if (quote.validUntil && quote.validUntil < new Date()) {
    return { error: "This quote has expired. Please ask for an updated one." } as const;
  }
  if (quote.approvalStatus === "PENDING" || quote.approvalStatus === "REJECTED") {
    return { error: "This quote is being revised. Your contact will send an updated version." } as const;
  }
  return { quote } as const;
}

/** Client accepts the quote online (no login; the token is the key). */
export async function acceptOnline(token: string, formData: FormData): Promise<PublicResult> {
  const loaded = await loadOpenQuote(token);
  if ("error" in loaded) return { error: loaded.error };

  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const title = String(formData.get("title") || "").trim().slice(0, 120);
  if (name.length < 3) return { error: "Please type your full name." };
  if (formData.get("agree") !== "on") return { error: "Please confirm that you accept the quote and its terms." };

  const ip = (headers().get("x-forwarded-for") || "").split(",")[0].trim() || null;
  await acceptQuote(loaded.quote.id, { userId: null, name, title, ip: ip || undefined });
  return { done: "accepted" };
}

export async function declineOnline(token: string, formData: FormData): Promise<PublicResult> {
  const loaded = await loadOpenQuote(token);
  if ("error" in loaded) return { error: loaded.error };
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  await rejectQuote(loaded.quote.id, { userId: null, reason });
  return { done: "declined" };
}
