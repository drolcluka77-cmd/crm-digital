"use client";

import { useEffect } from "react";
import Link from "next/link";
import { markAllNotificationsRead } from "@/app/notifications/actions";
import { NOTIFICATION_TYPE_LABEL } from "@/lib/constants";
import { timeAgo } from "@/lib/format";

type N = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationList({ items }: { items: N[] }) {
  // Opening the page marks everything as read (the list still shows what was new).
  useEffect(() => {
    if (items.some((n) => !n.read)) markAllNotificationsRead();
  }, [items]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-black/50 text-sm mt-1">
          Client activity, approvals, new leads and payouts. Important ones are also emailed (you can turn that off
          under your account settings).
        </p>
      </div>
      <div className="card divide-y divide-black/5">
        {items.map((n) => {
          const content = (
            <div className={`px-5 py-4 flex gap-3 ${n.read ? "" : "bg-brand-50/50"}`}>
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-brand-500"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-black/55 mt-0.5">{n.body}</div>}
                <div className="text-[11px] text-black/35 mt-1">
                  {NOTIFICATION_TYPE_LABEL[n.type] || n.type} · {timeAgo(n.createdAt)}
                </div>
              </div>
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} className="block hover:bg-sand-50">
              {content}
            </Link>
          ) : (
            <div key={n.id}>{content}</div>
          );
        })}
        {items.length === 0 && <div className="px-5 py-12 text-center text-sm text-black/40">Nothing yet.</div>}
      </div>
    </div>
  );
}
