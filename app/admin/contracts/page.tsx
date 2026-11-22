import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getManagedSellerIds } from "@/lib/access";
import { listContracts } from "@/lib/contract-view";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contracts";
import ContractList from "@/components/ContractList";
import ContractSettingsForm from "./ContractSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminContractsPage() {
  const user = await requireStaff();
  const sellerIds = await getManagedSellerIds(user);
  const [rows, s] = await Promise.all([
    listContracts(user.role === "ADMIN" ? {} : { userId: { in: sellerIds } }),
    getSettings(),
  ]);
  const waiting = rows.filter((r) => r.status === "IN_REVIEW");
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
        <p className="text-black/50 text-sm mt-1">
          Sellers create a contract from a quote{s.contractReviewRequired ? ", you review it" : ""}, the client signs
          online with a code from their e-mail, and a proforma invoice with a UPN QR code is sent automatically.
        </p>
      </div>

      {waiting.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Waiting for your review ({waiting.length})</h2>
          <ContractList rows={waiting} base="/admin/contracts" showSeller />
        </div>
      )}

      <h2 className="font-semibold mb-2">All contracts</h2>
      <ContractList rows={rows} base="/admin/contracts" showSeller />

      {user.role === "ADMIN" && (
        <ContractSettingsForm
          s={{
            legalName: s.legalName,
            legalAddress: s.legalAddress,
            legalRegNo: s.legalRegNo,
            legalTaxNo: s.legalTaxNo,
            legalVatId: s.legalVatId,
            legalVatPayer: s.legalVatPayer,
            legalIban: s.legalIban,
            legalBic: s.legalBic,
            legalBank: s.legalBank,
            legalRepresentative: s.legalRepresentative,
            legalEmail: s.legalEmail,
            contractReviewRequired: s.contractReviewRequired,
            proformaDueDays: s.proformaDueDays,
            contractTemplate: s.contractTemplate,
          }}
          defaultTemplate={DEFAULT_CONTRACT_TEMPLATE}
        />
      )}
    </div>
  );
}
