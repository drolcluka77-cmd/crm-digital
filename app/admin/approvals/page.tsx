import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { computeQuoteBreakdown } from "@/lib/format";
import ApprovalsList from "./ApprovalsList";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireStaff();
  const sellerIds = await getManagedSellerIds(user);

  const quotes = await prisma.quote.findMany({
    where: { userId: { in: sellerIds }, approvalStatus: { in: ["PENDING", "APPROVED", "REJECTED"] } },
    include: { items: true, customer: true, user: true, approvedBy: { select: { name: true } } },
    orderBy: { approvalRequestedAt: "desc" },
    take: 60,
  });

  return (
    <ApprovalsList
      quotes={quotes.map((q) => {
        const b = computeQuoteBreakdown(q.items, q.discount, q.vatRate);
        return {
          id: q.id,
          number: q.number,
          seller: q.user.name,
          customer: q.customer.company || q.customer.name,
          status: q.approvalStatus,
          reason: q.approvalReason,
          note: q.approvalNote,
          decidedBy: q.approvedBy?.name ?? null,
          requestedAt: q.approvalRequestedAt?.toISOString() ?? null,
          annualNet: b.annualNet,
          discount: q.discount,
          lines: q.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            listPrice: i.listPrice,
            billing: i.billing,
          })),
        };
      })}
    />
  );
}
