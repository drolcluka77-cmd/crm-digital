import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import CandidateDetail from "./CandidateDetail";
import { RECRUITING_POSITIONS } from "@/lib/recruiting-labels";

export const dynamic = "force-dynamic";

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  const c = await prisma.candidate.findUnique({ where: { id: params.id }, include: { hiredUser: { select: { id: true, name: true } } } });
  // Deleted (e.g. GDPR request or retention clean-up) — old notifications still link here.
  if (!c) redirect("/admin/recruiting?gone=1");
  const [managers, products] = await Promise.all([
    prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <CandidateDetail
      isAdmin={user.role === "ADMIN"}
      managers={managers}
      products={products}
      c={{
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.status,
        hours: c.hoursPerWeek,
        from: c.availableFrom,
        workMode: c.workMode,
        languages: c.languages,
        experience: c.experience,
        motivation: c.motivation,
        source: c.source,
        position: RECRUITING_POSITIONS[c.position]?.label || c.position,
        cvName: c.cvName,
        hasCv: !!c.cvKey,
        stage: c.stage,
        rating: c.rating,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        consentAt: c.consentAt.toISOString(),
        invitedAt: c.invitedAt?.toISOString() ?? null,
        reminderAt: c.reminderAt?.toISOString() ?? null,
        clickedAt: c.clickedAt?.toISOString() ?? null,
        bookedAt: c.bookedAt?.toISOString() ?? null,
        hiredUser: c.hiredUser,
      }}
    />
  );
}
