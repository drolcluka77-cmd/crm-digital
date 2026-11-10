import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ReactNode;
  tone?: "default" | "dark" | "accent";
}) {
  const toneClasses =
    tone === "dark"
      ? "bg-ink-900 text-white"
      : tone === "accent"
      ? "bg-brand-500 text-white"
      : "bg-white text-ink-900";

  return (
    <div className={`card p-5 ${toneClasses} ${tone !== "default" ? "border-transparent" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            tone === "default" ? "text-black/40" : "text-white/60"
          }`}
        >
          {label}
        </div>
        {icon && (
          <span className={tone === "default" ? "text-brand-500" : "text-white/70"}>
            {icon}
          </span>
        )}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      {sublabel && (
        <div
          className={`text-xs mt-1 ${
            tone === "default" ? "text-black/40" : "text-white/50"
          }`}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}
