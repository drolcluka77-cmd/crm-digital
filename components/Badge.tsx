const STYLES: Record<string, string> = {
  // Lead statuses
  NEW: "bg-slate-100 text-slate-600",
  CONTACTED: "bg-sky-100 text-sky-700",
  DEMO_SCHEDULED: "bg-violet-100 text-violet-700",
  DEMO_DONE: "bg-indigo-100 text-indigo-700",
  QUOTE_SENT: "bg-brand-100 text-brand-700",
  NEGOTIATION: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-rose-100 text-rose-600",
  // Quote statuses
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-sky-100 text-sky-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-600",
  // Misc
  INFO: "bg-brand-50 text-brand-700",
  MUTED: "bg-black/5 text-black/50",
  WARN: "bg-amber-100 text-amber-700",
};

export default function Badge({
  children,
  variant = "NEW",
  className = "",
}: {
  children: React.ReactNode;
  variant?: string;
  className?: string;
}) {
  return <span className={`badge ${STYLES[variant] || STYLES.NEW} ${className}`}>{children}</span>;
}
