import { prisma } from "@/lib/prisma";

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function loadNotifications(userId: string) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  }));
}
