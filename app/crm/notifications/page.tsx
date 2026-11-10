import { requireSales } from "@/lib/session";
import { loadNotifications } from "@/lib/notifications";
import NotificationList from "@/components/NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireSales();
  return <NotificationList items={await loadNotifications(user.id)} />;
}
