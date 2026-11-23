import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import AccountForm from "./AccountForm";
import ProfileForm from "./ProfileForm";
import LanguageForm from "./LanguageForm";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const t = await getT();
  const user = await requireSales();
  const me = await prisma.user.findUnique({ where: { id: user.id } });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Account")}</h1>
        <p className="text-black/50 text-sm mt-1">
          {t("Signed in as ")}{user.name} ({user.email})
        </p>
      </div>
      <LanguageForm />
      <ProfileForm
        phone={me?.phone ?? null}
        bookingUrl={me?.bookingUrl ?? null}
        emailNotifications={me?.emailNotifications ?? true}
      />
      <AccountForm />
    </div>
  );
}
