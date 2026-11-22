import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/url";
import { formatMoney } from "@/lib/format";
import { CONTRACT_STATUS_LABEL, contractProblems, proformaLines } from "@/lib/contracts";
import type { ContractView } from "@/components/ContractEditor";

/** Loads a contract shaped for ContractEditor. */
export async function loadContractView(id: string): Promise<{ view: ContractView; userId: string; reviewRequired: boolean } | null> {
  const c = await prisma.contract.findUnique({
    where: { id },
    include: {
      quote: { include: { items: true } },
      customer: { select: { name: true, company: true } },
      user: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!c) return null;
  const s = await getSettings();
  return {
    userId: c.userId,
    reviewRequired: s.contractReviewRequired,
    view: {
      id: c.id,
      number: c.number,
      status: c.status,
      statusLabel: CONTRACT_STATUS_LABEL[c.status] || c.status,
      title: c.title,
      body: c.body,
      clientCompany: c.clientCompany,
      clientAddress: c.clientAddress,
      clientRegNo: c.clientRegNo,
      clientVatId: c.clientVatId,
      clientRepresentative: c.clientRepresentative,
      clientEmail: c.clientEmail,
      customerId: c.customerId,
      customerName: c.customer.company || c.customer.name,
      quoteId: c.quoteId,
      quoteNumber: c.quote.number,
      sellerName: c.user.name,
      reviewNote: c.reviewNote,
      reviewedBy: c.reviewedBy?.name ?? null,
      reviewedAt: c.reviewedAt?.toISOString() ?? null,
      sentAt: c.sentAt?.toISOString() ?? null,
      viewedAt: c.viewedAt?.toISOString() ?? null,
      signedName: c.signedName,
      signedTitle: c.signedTitle,
      signedAt: c.signedAt?.toISOString() ?? null,
      signedIp: c.signedIp,
      documentHash: c.documentHash,
      proformaNumber: c.proformaNumber,
      proformaDueAt: c.proformaDueAt?.toISOString() ?? null,
      proformaTotal: c.proformaNumber ? formatMoney(proformaLines(c.quote, s.legalVatPayer).total) : null,
      paidAt: c.paidAt?.toISOString() ?? null,
      signingLink: c.publicToken ? `${getBaseUrl()}/c/${c.publicToken}` : null,
      problems: contractProblems(c),
    },
  };
}

/** List rows for the contracts tables. */
export async function listContracts(where: { userId?: string | { in: string[] } }) {
  const rows = await prisma.contract.findMany({
    where,
    include: { customer: { select: { name: true, company: true } }, user: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    status: c.status,
    statusLabel: CONTRACT_STATUS_LABEL[c.status] || c.status,
    client: c.clientCompany || c.customer.company || c.customer.name,
    seller: c.user.name,
    updatedAt: c.updatedAt.toISOString(),
    signedAt: c.signedAt?.toISOString() ?? null,
    proformaNumber: c.proformaNumber,
    paid: !!c.paidAt,
  }));
}
