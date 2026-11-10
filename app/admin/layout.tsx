import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getManagedSellerIds } from "@/lib/access";
import { unreadCount } from "@/lib/notifications";
import { ROLE_LABEL } from "@/lib/constants";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import {
  GridIcon,
  UsersIcon,
  PackageIcon,
  FolderIcon,
  SettingsIcon,
  ShieldIcon,
  MailIcon,
  CheckCircleIcon,
  SparkIcon,
  ChartIcon,
  CoinsIcon,
  FileIcon,
} from "@/components/icons";

const ic = "h-[18px] w-[18px]";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const [settings, unread, sellerIds] = await Promise.all([
    getSettings(),
    unreadCount(user.id),
    getManagedSellerIds(user),
  ]);
  const pendingApprovals = await prisma.quote.count({
    where: { userId: { in: sellerIds }, approvalStatus: "PENDING" },
  });

  const sections: NavSection[] = [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: <GridIcon className={ic} /> },
        { href: "/admin/approvals", label: "Approvals", icon: <CheckCircleIcon className={ic} />, badge: pendingApprovals },
        { href: "/admin/notifications", label: "Notifications", icon: <MailIcon className={ic} />, badge: unread },
      ],
    },
    {
      heading: "Catalog",
      items: isAdmin
        ? [
            { href: "/admin/products", label: "Products", icon: <PackageIcon className={ic} /> },
            { href: "/admin/materials", label: "Sales materials", icon: <FolderIcon className={ic} /> },
            { href: "/admin/templates", label: "Email templates", icon: <FileIcon className={ic} /> },
          ]
        : [{ href: "/admin/products", label: "Products", icon: <PackageIcon className={ic} /> }],
    },
    {
      heading: "Sales",
      items: [
        { href: "/admin/leads", label: "Lead pools", icon: <SparkIcon className={ic} /> },
        { href: "/admin/subscriptions", label: "Subscriptions", icon: <ChartIcon className={ic} /> },
        { href: "/admin/commissions", label: "Commissions", icon: <CoinsIcon className={ic} /> },
      ],
    },
    {
      heading: "People",
      items: [
        { href: "/admin/team", label: isAdmin ? "Team" : "My team", icon: <UsersIcon className={ic} /> },
        { href: "/admin/access", label: "Product access", icon: <ShieldIcon className={ic} /> },
      ],
    },
    {
      items: [{ href: "/admin/settings", label: "Settings", icon: <SettingsIcon className={ic} /> }],
    },
  ];

  return (
    <div className="lg:flex min-h-screen bg-sand-50">
      <Sidebar
        sections={sections}
        brand={settings.companyName}
        subtitle={isAdmin ? "Admin console" : "Manager console"}
        user={{ name: user.name, email: user.email, roleLabel: ROLE_LABEL[user.role] }}
        notificationsHref="/admin/notifications"
        unread={unread}
      />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
