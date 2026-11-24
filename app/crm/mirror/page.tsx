import { requireSales } from "@/lib/session";
import MirrorHome from "@/components/MirrorHome";

export const dynamic = "force-dynamic";

export default async function MirrorPage({ searchParams }: { searchParams: { customer?: string } }) {
  const user = await requireSales();
  return <MirrorHome user={user} basePath="/crm/mirror" customerId={searchParams.customer} />;
}
