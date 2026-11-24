import { prisma } from "@/lib/prisma";
import { requireGeoArea } from "@/lib/session";
import TaskList, { type TaskRow } from "./TaskList";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const user = await requireGeoArea();
  const isAdmin = user.role === "ADMIN";
  const mine = ["GEO", "FDE", "IMPORT"].includes(user.role);
  const rows = await prisma.geoTask.findMany({
    where: {
      ...(mine ? { assigneeId: user.id } : {}),
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "WAITING_APPROVAL"] },
      client: { status: { notIn: ["DRAFT", "HANDED_OVER"] } },
    },
    include: { client: { select: { company: true } }, assignee: { select: { name: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const map = (t: (typeof rows)[number]): TaskRow => ({
    id: t.id,
    title: t.title,
    description: t.description,
    phase: t.phase,
    dueDate: t.dueDate?.toISOString() ?? null,
    status: t.status,
    note: t.note,
    needsApproval: t.needsApproval,
    technical: t.technical,
    clientId: t.clientId,
    company: t.client.company,
    assignee: t.assignee?.name ?? null,
  });
  const active = rows.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status));
  const overdue = active.filter((t) => t.dueDate && t.dueDate < now);
  const week = active.filter((t) => !t.dueDate || (t.dueDate >= now && t.dueDate <= weekEnd));
  const later = active.filter((t) => t.dueDate && t.dueDate > weekEnd);
  const waiting = rows.filter((t) => t.status === "WAITING_CLIENT");
  const approval = rows.filter((t) => t.status === "WAITING_APPROVAL");

  const Section = ({ title, items, hint, empty }: { title: string; items: typeof rows; hint?: string; empty?: string }) => (
    <div className="card mb-5">
      <div className="px-4 pt-4 pb-2 flex items-baseline justify-between gap-3">
        <div className="font-semibold">
          {title} <span className="text-black/40 font-normal">{items.length}</span>
        </div>
        {hint && <div className="text-xs text-black/40">{hint}</div>}
      </div>
      <TaskList tasks={items.map(map)} isAdmin={isAdmin} empty={empty} />
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{mine ? "Moje naloge" : "Naloge vseh asistentov"}</h1>
      <p className="text-black/50 text-sm mt-1 mb-6">
        Klikni nalogo za korake. Vse, kar gre v javnost (objave, odgovori na ocene, poročila, koda na strani), gre najprej v potrditev.
      </p>
      {overdue.length > 0 && <Section title="Zamujene" items={overdue} />}
      <Section title="Ta teden" items={week} empty="Ta teden ni nalog." />
      <Section title="Čaka stranko" items={waiting} hint="Po tednu dni dobiš opomnik, da stranko pokličeš." empty="Nič ne čaka stranke." />
      <Section title="Čaka potrditev" items={approval} hint={isAdmin ? "Potrdi ali vrni v delo." : "Potrdi administrator."} empty="Nič ne čaka potrditve." />
      <Section title="Kasneje" items={later} empty="Ni kasnejših nalog." />
    </div>
  );
}
