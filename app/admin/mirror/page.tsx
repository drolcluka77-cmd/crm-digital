import { requireStaff } from "@/lib/session";
import MirrorHome from "@/components/MirrorHome";

export const dynamic = "force-dynamic";

export default async function AdminMirrorPage({ searchParams }: { searchParams: { customer?: string } }) {
  const user = await requireStaff();
  return <MirrorHome user={user} basePath="/admin/mirror" customerId={searchParams.customer} everyone />;
}
