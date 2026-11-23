import { requireGeoArea } from "@/lib/session";
import { loadNotifications } from "@/lib/notifications";
import NotificationList from "@/components/NotificationList";

export const dynamic = "force-dynamic";

export default async function GeoNotificationsPage() {
  const user = await requireGeoArea();
  return <NotificationList items={await loadNotifications(user.id)} />;
}
