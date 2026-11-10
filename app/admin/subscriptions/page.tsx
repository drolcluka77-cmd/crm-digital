import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { loadSubscriptions } from "@/lib/subscriptions";
import SubscriptionsView from "@/components/SubscriptionsView";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const user = await requireStaff();
  const data = await loadSubscriptions(user.role === "ADMIN" ? "ALL" : await getManagedSellerIds(user));
  return <SubscriptionsView data={data} showSeller customerBase={null} />;
}
