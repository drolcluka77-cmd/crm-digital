import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/url";
import { DEFAULT_INVITE_BODY, DEFAULT_INVITE_SUBJECT } from "@/lib/recruiting";
import RecruitingManager from "./RecruitingManager";

export const dynamic = "force-dynamic";

export default async function RecruitingPage({ searchParams }: { searchParams: { gone?: string } }) {
  await requireStaff();
  const [settings, candidates] = await Promise.all([
    getSettings(),
    prisma.candidate.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  return (
    <RecruitingManager
      notice={searchParams.gone ? "That candidate no longer exists — the application was deleted." : null}
      formUrl={`${getBaseUrl()}/prijava?vir=studentski-servis`}
      settings={{
        calendly: settings.recruitingCalendlyUrl || "",
        autoInvite: settings.recruitingAutoInvite,
        autoReminder: settings.recruitingAutoReminder,
        subject: settings.recruitingInviteSubject || DEFAULT_INVITE_SUBJECT,
        body: settings.recruitingInviteBody || DEFAULT_INVITE_BODY,
        retention: settings.recruitingRetentionMonths,
      }}
      candidates={candidates.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.status,
        hours: c.hoursPerWeek,
        workMode: c.workMode,
        source: c.source,
        stage: c.stage,
        rating: c.rating,
        hasCv: !!c.cvKey,
        createdAt: c.createdAt.toISOString(),
        invitedAt: c.invitedAt?.toISOString() ?? null,
        clickedAt: c.clickedAt?.toISOString() ?? null,
        bookedAt: c.bookedAt?.toISOString() ?? null,
      }))}
    />
  );
}
