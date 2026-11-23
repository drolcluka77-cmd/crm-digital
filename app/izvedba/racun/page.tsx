import { requireGeoArea } from "@/lib/session";
import AccountForm from "@/app/crm/account/AccountForm";

export const dynamic = "force-dynamic";

export default async function GeoAccountPage() {
  const user = await requireGeoArea();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Račun</h1>
      <p className="text-black/50 text-sm mt-1 mb-6">
        Prijavljen(a) kot {user.name} ({user.email})
      </p>
      <AccountForm />
    </div>
  );
}
