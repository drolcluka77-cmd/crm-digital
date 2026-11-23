import { requireGeoArea } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { unreadCount } from "@/lib/notifications";
import { ROLE_LABEL } from "@/lib/constants";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import { GridIcon, UsersIcon, MailIcon, SettingsIcon, ChartIcon } from "@/components/icons";
import { LocaleProvider } from "@/components/LocaleProvider";

const ic = "h-[18px] w-[18px]";

export default async function IzvedbaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireGeoArea();
  const [settings, unread] = await Promise.all([getSettings(), unreadCount(user.id)]);
  const staff = user.role !== "GEO";
  const sections: NavSection[] = [
    {
      items: [
        { href: "/izvedba", label: staff ? "Naloge" : "Moje naloge", icon: <GridIcon className={ic} /> },
        { href: "/izvedba/stranke", label: "Stranke", icon: <UsersIcon className={ic} /> },
        ...(staff ? [] : [{ href: "/izvedba/obvestila", label: "Obvestila", icon: <MailIcon className={ic} />, badge: unread }]),
      ],
    },
    {
      items: staff
        ? [{ href: "/admin/geo", label: "← Nazaj v konzolo", icon: <ChartIcon className={ic} /> }]
        : [{ href: "/izvedba/racun", label: "Račun", icon: <SettingsIcon className={ic} /> }],
    },
  ];
  return (
    <LocaleProvider locale="sl">
      <div className="lg:flex min-h-screen bg-sand-50">
        <Sidebar
          sections={sections}
          brand={settings.companyName}
          subtitle="Izvedba · Mr. Picked"
          user={{ name: user.name, email: user.email, roleLabel: user.role === "GEO" ? "GEO asistent" : ROLE_LABEL[user.role] }}
          notificationsHref={staff ? "/admin/notifications" : "/izvedba/obvestila"}
          unread={unread}
        />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8">{children}</div>
        </main>
      </div>
    </LocaleProvider>
  );
}
