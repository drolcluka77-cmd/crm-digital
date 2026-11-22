import Link from "next/link";
import Badge from "@/components/Badge";

type Row = {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  client: string;
  seller: string;
  updatedAt: string;
  signedAt: string | null;
  proformaNumber: string | null;
  paid: boolean;
};

const variant = (s: string) => (s === "SIGNED" ? "WON" : s === "CANCELLED" ? "LOST" : s === "IN_REVIEW" ? "WARN" : s === "SENT" ? "SENT" : s === "APPROVED" ? "INFO" : "MUTED");

export default function ContractList({ rows, base, showSeller }: { rows: Row[]; base: string; showSeller?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-black/40">
        No contracts yet. Open a quote and click “Create contract”.
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-black/40 border-b border-black/5">
            <th className="px-5 py-3 font-medium">Contract</th>
            <th className="px-3 py-3 font-medium">Client</th>
            {showSeller && <th className="px-3 py-3 font-medium">Seller</th>}
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Proforma</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-black/[0.02]">
              <td className="px-5 py-3">
                <Link href={`${base}/${r.id}`} className="font-medium text-brand-700 hover:underline">
                  {r.number}
                </Link>
              </td>
              <td className="px-3 py-3">{r.client}</td>
              {showSeller && <td className="px-3 py-3 text-black/60">{r.seller}</td>}
              <td className="px-3 py-3">
                <Badge variant={variant(r.status)}>{r.statusLabel}</Badge>
              </td>
              <td className="px-5 py-3 text-black/60">
                {r.proformaNumber ? (
                  <>
                    {r.proformaNumber} · {r.paid ? <span className="text-emerald-700">paid</span> : "unpaid"}
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
