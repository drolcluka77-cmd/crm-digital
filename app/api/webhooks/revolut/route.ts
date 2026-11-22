import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getRevolutOrder, revolutEnabled, verifyRevolutSignature } from "@/lib/revolut";
import { markProformaPaid } from "@/lib/contract-signing";

export const dynamic = "force-dynamic";

/**
 * Revolut Merchant webhook. The signature is checked when we have the
 * signing secret, and the order's state is always re-read from Revolut,
 * so a forged call can't mark anything as paid.
 */
export async function POST(req: NextRequest) {
  if (!revolutEnabled()) return new NextResponse(null, { status: 204 });
  const raw = await req.text();
  const s = await getSettings();
  if (s.revolutWebhookSecret) {
    const ok = verifyRevolutSignature(
      raw,
      req.headers.get("revolut-request-timestamp"),
      req.headers.get("revolut-signature"),
      s.revolutWebhookSecret
    );
    if (!ok) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const orderId = String(body?.order_id || "");
  if (!orderId || !/^ORDER_(COMPLETED|AUTHORISED)$/.test(String(body?.event || ""))) {
    return new NextResponse(null, { status: 204 });
  }
  const contract = await prisma.contract.findUnique({ where: { revolutOrderId: orderId }, select: { id: true, paidAt: true } });
  if (!contract || contract.paidAt) return new NextResponse(null, { status: 204 });
  try {
    const order = await getRevolutOrder(orderId);
    if (order.state === "completed") await markProformaPaid(contract.id, "Revolut card payment");
  } catch (e) {
    console.error("Revolut webhook: couldn't read the order", e);
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
