import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { canSeeContract } from "@/lib/contracts";
import { loadContractView } from "@/lib/contract-view";
import ContractEditor from "@/components/ContractEditor";

export const dynamic = "force-dynamic";

export default async function AdminContractPage({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  const r = await loadContractView(params.id);
  if (!r || !(await canSeeContract(user, { userId: r.userId }))) notFound();
  return (
    <div>
      <Link href="/admin/contracts" className="text-sm text-black/40 hover:text-black/60">← All contracts</Link>
      <div className="mt-3">
        <ContractEditor
          c={r.view}
          role={user.role}
          reviewRequired={r.reviewRequired}
          customerHref={null}
          quoteHref={null}
        />
      </div>
    </div>
  );
}
