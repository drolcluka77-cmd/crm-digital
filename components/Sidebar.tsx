"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import { LayersIcon, LogOutIcon, XIcon } from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Small count bubble (unread notifications, pending approvals…). */
  badge?: number;
};

export type NavSection = {
  heading?: string;
  items: NavItem[];
};

/**
 * Desktop: fixed sidebar. Phone/tablet: a slim top bar with a menu button
 * that opens the same navigation as a drawer.
 */
export default function Sidebar({
  sections,
  user,
  brand,
  subtitle,
  notificationsHref,
  unread = 0,
}: {
  sections: NavSection[];
  user: { name: string; email: string; roleLabel?: string };
  brand: string;
  subtitle: string;
  notificationsHref?: string;
  unread?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating.
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/admin" || href === "/crm"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  const logo = (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="h-9 w-9 rounded-xl bg-brand-400 flex items-center justify-center text-white shrink-0">
        <LayersIcon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-white leading-tight truncate max-w-[150px]">{brand}</div>
        <div className="text-[11px] text-white/40 tracking-wide uppercase">{subtitle}</div>
      </div>
    </div>
  );

  const nav = (
    <>
      <nav className="flex-1 overflow-y-auto px-3 space-y-6 pb-4">
        {sections.map((section, idx) => (
          <div key={idx}>
            {section.heading && (
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-white/35 uppercase">
                {section.heading}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active ? "bg-brand-500 text-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="opacity-90">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {!!item.badge && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-semibold flex items-center justify-center">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-white/40 truncate">
              {user.roleLabel ? `${user.roleLabel} · ` : ""}
              {user.email}
            </div>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-full px-1"
          >
            <LogOutIcon className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Phone / tablet top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-ink-900 text-white flex items-center justify-between px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          className="h-10 w-10 -ml-2 flex items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="font-semibold truncate px-2">{brand}</div>
        {notificationsHref ? (
          <Link href={notificationsHref} className="relative h-10 w-10 -mr-2 flex items-center justify-center rounded-lg hover:bg-white/10" aria-label="Notifications">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
              <path d="M10 19a2 2 0 0 0 4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-semibold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        ) : (
          <span className="w-10" />
        )}
      </header>

      {/* Phone / tablet drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink-900/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-ink-900 text-white/90 flex flex-col h-full">
            <div className="px-5 pt-5 pb-5 flex items-center justify-between gap-2">
              {logo}
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white" aria-label="Close menu">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-ink-900 text-white/90 flex-col h-screen sticky top-0">
        <div className="px-5 pt-6 pb-5">{logo}</div>
        {nav}
      </aside>
    </>
  );
}
