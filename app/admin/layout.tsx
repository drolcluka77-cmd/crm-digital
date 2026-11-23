import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getManagedSellerIds } from "@/lib/access";
import { unreadCount } from "@/lib/notifications";
import { ROLE_LABEL } from "@/lib/constants";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import {
  GridIcon,
  ClockIcon,
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
  PlayIcon,
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
  const [pendingApprovals, pendingUgc, pendingContracts, geoPending] = await Promise.all([
    prisma.quote.count({ where: { userId: { in: sellerIds }, approvalStatus: "PENDING" } }),
    prisma.ugcVideo.count({ where: { creatorId: { in: sellerIds }, status: "SUBMITTED" } }),
    prisma.contract.count({ where: { status: "IN_REVIEW", ...(isAdmin ? {} : { userId: { in: sellerIds } }) } }),
    isAdmin
      ? Promise.all([
          prisma.geoClient.count({ where: { status: "HANDED_OVER" } }),
          prisma.geoTask.count({ where: { status: "WAITING_APPROVAL" } }),
        ]).then(([a, b]) => a + b)
      : Promise.resolve(0),
  ]);

  const sections: NavSection[] = [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: <GridIcon className={ic} /> },
        { href: "/admin/approvals", label: "Approvals", icon: <CheckCircleIcon className={ic} />, badge: pendingApprovals },
        { href: "/admin/contracts", label: "Contracts", icon: <FileIcon className={ic} />, badge: pendingContracts },
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
        { href: "/admin/lead-finder", label: "Lead finder", icon: <SparkIcon className={ic} /> },
        { href: "/admin/leads", label: "Lead pools", icon: <SparkIcon className={ic} /> },
        { href: "/admin/ugc", label: "UGC creators", icon: <PlayIcon className={ic} />, badge: pendingUgc },
        { href: "/admin/subscriptions", label: "Subscriptions", icon: <ChartIcon className={ic} /> },
        { href: "/admin/payments", label: "Payments", icon: <CoinsIcon className={ic} /> },
        { href: "/admin/commissions", label: "Commissions", icon: <CoinsIcon className={ic} /> },
        { href: "/admin/geo", label: "GEO delivery", icon: <GridIcon className={ic} />, badge: geoPending },
      ],
    },
    {
      heading: "People",
      items: [
        { href: "/admin/team", label: isAdmin ? "Team" : "My team", icon: <UsersIcon className={ic} /> },
        { href: "/admin/access", label: "Product access", icon: <ShieldIcon className={ic} /> },
        { href: "/admin/recruiting", label: "Recruiting", icon: <UsersIcon className={ic} /> },
        { href: "/admin/timesheets", label: "Timesheets", icon: <ClockIcon className={ic} /> },
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
        subtitle={isAdmin ? "Distribution Hub · Admin" : "Distribution Hub · Manager"}
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
