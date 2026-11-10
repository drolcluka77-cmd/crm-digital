import { getSettings } from "@/lib/settings";
import { requireStaff } from "@/lib/session";
import AccountForm from "@/app/crm/account/AccountForm";
import ProfileForm from "@/app/crm/account/ProfileForm";
import { prisma } from "@/lib/prisma";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireStaff();

  const me = await prisma.user.findUnique({ where: { id: user.id } });
  const profile = (
    <ProfileForm
      phone={me?.phone ?? null}
      bookingUrl={null}
      emailNotifications={me?.emailNotifications ?? true}
      showBooking={false}
    />
  );

  if (user.role !== "ADMIN") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-black/50 text-sm mt-1">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        {profile}
        <AccountForm />
      </div>
    );
  }

  const settings = await getSettings();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-black/50 text-sm mt-1">
          Company details shown on quotes and in the app, quote defaults, and the email account used to send quotes
          and materials.
        </p>
      </div>
      {profile}
      <SettingsForm
        settings={{
          companyName: settings.companyName,
          companyAddress: settings.companyAddress,
          companyEmail: settings.companyEmail,
          companyPhone: settings.companyPhone,
          vatRate: settings.vatRate,
          quoteValidityDays: settings.quoteValidityDays,
          defaultMaxDiscount: settings.defaultMaxDiscount,
          commissionTiers: settings.commissionTiers,
          renewalTermMonths: settings.renewalTermMonths,
          logoUrl: settings.logoUrl,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpFrom: settings.smtpFrom,
          hasSmtpPassword: !!settings.smtpPass,
        }}
      />
    </div>
  );
}
