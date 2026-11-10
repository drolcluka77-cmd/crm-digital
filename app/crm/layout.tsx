import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { unreadCount } from "@/lib/notifications";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import {
  GridIcon,
  UsersIcon,
  FileIcon,
  FolderIcon,
  SettingsIcon,
  PackageIcon,
  CoinsIcon,
  ChartIcon,
  PencilIcon,
  SparkIcon,
  MailIcon,
} from "@/components/icons";

const ic = "h-[18px] w-[18px]";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSales();
  const [settings, unread] = await Promise.all([getSettings(), unreadCount(user.id)]);

  const sections: NavSection[] = [
    {
      items: [
        { href: "/crm", label: "Today", icon: <GridIcon className={ic} /> },
        { href: "/crm/quick", label: "Quick log", icon: <PencilIcon className={ic} /> },
        { href: "/crm/notifications", label: "Notifications", icon: <MailIcon className={ic} />, badge: unread },
      ],
    },
    {
      heading: "Sell",
      items: [
        { href: "/crm/products", label: "My products", icon: <PackageIcon className={ic} /> },
        { href: "/crm/customers", label: "Customers", icon: <UsersIcon className={ic} /> },
        { href: "/crm/pool", label: "Lead pool", icon: <SparkIcon className={ic} /> },
        { href: "/crm/quotes", label: "Quotes", icon: <FileIcon className={ic} /> },
        { href: "/crm/library", label: "Sales library", icon: <FolderIcon className={ic} /> },
      ],
    },
    {
      heading: "Earn",
      items: [
        { href: "/crm/subscriptions", label: "Subscriptions", icon: <ChartIcon className={ic} /> },
        { href: "/crm/commission", label: "My commission", icon: <CoinsIcon className={ic} /> },
      ],
    },
    { items: [{ href: "/crm/account", label: "Account", icon: <SettingsIcon className={ic} /> }] },
  ];

  return (
    <div className="lg:flex min-h-screen bg-sand-50">
      <Sidebar
        sections={sections}
        brand={settings.companyName}
        subtitle="Seller CRM"
        user={{ name: user.name, email: user.email }}
        notificationsHref="/crm/notifications"
        unread={unread}
      />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
