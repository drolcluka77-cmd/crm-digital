import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import AccountForm from "./AccountForm";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireSales();
  const me = await prisma.user.findUnique({ where: { id: user.id } });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-black/50 text-sm mt-1">
          Signed in as {user.name} ({user.email})
        </p>
      </div>
      <ProfileForm
        phone={me?.phone ?? null}
        bookingUrl={me?.bookingUrl ?? null}
        emailNotifications={me?.emailNotifications ?? true}
      />
      <AccountForm />
    </div>
  );
}
