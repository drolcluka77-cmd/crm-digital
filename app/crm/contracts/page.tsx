import { requireSales } from "@/lib/session";
import { listContracts } from "@/lib/contract-view";
import ContractList from "@/components/ContractList";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function SellerContractsPage() {
  const t = await getT();
  const user = await requireSales();
  const rows = await listContracts({ userId: user.id });
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Contracts")}</h1>
        <p className="text-black/50 text-sm mt-1">
          {t("Made from a quote. Your manager reviews it, the client signs online, and a proforma invoice goes out automatically.")}
        </p>
      </div>
      <ContractList rows={rows} base="/crm/contracts" />
    </div>
  );
}
