import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { LayersIcon } from "@/components/icons";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const settings = await getSettings();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-white">
            <span className="h-9 w-9 rounded-xl bg-brand-400 flex items-center justify-center text-white">
              <LayersIcon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-xl font-semibold tracking-tight">{settings.companyName}</span>
          </div>
          <p className="text-brand-100/80 text-sm mt-2">Distribution Hub</p>
        </div>
        <div className="card p-7">
          <h1 className="text-lg font-semibold mb-5">Sign in</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
