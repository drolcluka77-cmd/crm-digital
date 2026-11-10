import { requireSales } from "@/lib/session";
import { loadSubscriptions } from "@/lib/subscriptions";
import SubscriptionsView from "@/components/SubscriptionsView";

export const dynamic = "force-dynamic";

export default async function SellerSubscriptionsPage() {
  const user = await requireSales();
  const data = await loadSubscriptions([user.id]);
  return <SubscriptionsView data={data} showSeller={false} customerBase="/crm/customers" />;
}
