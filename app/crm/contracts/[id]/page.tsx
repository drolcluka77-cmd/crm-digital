import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSales } from "@/lib/session";
import { loadContractView } from "@/lib/contract-view";
import ContractEditor from "@/components/ContractEditor";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function SellerContractPage({ params }: { params: { id: string } }) {
  const t = await getT();
  const user = await requireSales();
  const r = await loadContractView(params.id);
  if (!r || r.userId !== user.id) notFound();
  return (
    <div>
      <Link href="/crm/contracts" className="text-sm text-black/40 hover:text-black/60">{t("← All contracts")}</Link>
      <div className="mt-3">
        <ContractEditor
          c={r.view}
          role={user.role}
          reviewRequired={r.reviewRequired}
          customerHref={`/crm/customers/${r.view.customerId}`}
          quoteHref={`/crm/quotes/${r.view.quoteId}`}
        />
      </div>
    </div>
  );
}
