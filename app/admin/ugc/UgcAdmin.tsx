"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { UGC_STATUS_LABEL } from "@/lib/ugc-labels";
import { reviewVideo, setViews, saveTask, setTaskStatus, deleteTask, generateIdeas, saveUgcSettings } from "./actions";

type Video = {
  id: string;
  title: string;
  status: string;
  creator: string;
  code: string | null;
  product: string | null;
  task: string | null;
  note: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  hasFile: boolean;
  linkUrl: string | null;
  postUrl: string | null;
  views: number | null;
  viewsAt: string | null;
  basePay: number;
  bonus: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
type Task = {
  id: string;
  title: string;
  brief: string | null;
  theme: string | null;
  productId: string | null;
  product: string | null;
  status: string;
  ai: boolean;
  weekOf: string | null;
  videos: number;
};
type Creator = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  since: string | null;
  clicks: number;
  clicks30: number;
  leads: number;
  won: number;
  published: number;
  views: number;
  earned: number;
};

const eur = (n: number) => n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
const day = (d: string) => new Date(d).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric", year: "numeric" });
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
const STATUS_BADGE: Record<string, string> = { SUBMITTED: "SENT", CHANGES: "WARN", APPROVED: "ACCEPTED", REJECTED: "REJECTED", PUBLISHED: "WON" };
const TASK_BADGE: Record<string, string> = { DRAFT: "MUTED", PUBLISHED: "WON", CLOSED: "NEW" };

export default function UgcAdmin(props: {
  tab: string;
  isAdmin: boolean;
  aiReady: boolean;
  products: { id: string; name: string }[];
  settings: { pay: number; tiers: string; terms: string; warmHours: number; website: string };
  videos: Video[];
  tasks: Task[];
  creators: Creator[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState(props.tab);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [views, setViewsInput] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(r || null);
      if (!r?.error) router.refresh();
      return r;
    } catch (e: any) {
      setMsg({ error: e?.message || "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };

  const review = props.videos.filter((v) => v.status === "SUBMITTED");
  const waiting = props.videos.filter((v) => v.status === "CHANGES" || v.status === "APPROVED");
  const published = props.videos.filter((v) => v.status === "PUBLISHED");
  const needViews = published.filter((v) => v.views === null && v.publishedAt && daysSince(v.publishedAt) >= 14);
  const drafts = props.tasks.filter((t) => t.status === "DRAFT");

  const tabs: [string, string, number][] = [
    ["review", "To review", review.length],
    ["published", "Published", needViews.length],
    ["ideas", "Video ideas", drafts.length],
    ["creators", "Creators", 0],
    ...(props.isAdmin ? ([["settings", "Settings", 0]] as [string, string, number][]) : []),
  ];

  const videoLink = (v: Video) =>
    (v.hasFile || v.linkUrl) && (
      <a href={`/api/ugc/${v.id}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 text-xs">
        ▶ View video
      </a>
    );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">UGC creators</h1>
        <p className="text-black/50 text-sm mt-1">
          Sellers who film short videos, posted as an Instagram Collab with Unbusyness. Pay: {eur(props.settings.pay)} per published video
          + view bonus ({props.settings.tiers || "no tiers"}). Enter views 14 days after posting (Unbusyness profile → post → insights).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([key, label, n]) => (
          <button key={key} className={tab === key ? "chip-active" : "chip"} onClick={() => { setTab(key); setMsg(null); }}>
            {label}
            {n > 0 && <span className="ml-1.5 rounded-full bg-rose-500 text-white text-[10px] px-1.5">{n}</span>}
          </button>
        ))}
      </div>
      {msg && <div className={`${msg.error ? "error-box" : "success-box"} mb-4`}>{msg.error || msg.success}</div>}

      {tab === "review" && (
        <div className="space-y-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-black/5 font-semibold">Waiting for review ({review.length})</div>
            {review.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-black/40">Nothing to review.</div>
            ) : (
              <div className="divide-y divide-black/5">
                {review.map((v) => (
                  <div key={v.id} className="px-5 py-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-medium">{v.title}</div>
                        <div className="text-xs text-black/45">
                          {[v.creator, v.product, v.task && `idea: ${v.task}`, `sent ${day(v.updatedAt)}`].filter(Boolean).join(" · ")}
                        </div>
                        {v.note && <div className="text-xs text-black/60 mt-1 whitespace-pre-wrap">“{v.note}”</div>}
                      </div>
                      {videoLink(v)}
                    </div>
                    <textarea
                      className="input mt-3 text-sm"
                      rows={2}
                      placeholder="Comment for the creator (required for changes / reject)"
                      value={notes[v.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button className="btn-primary !py-1.5 text-xs" disabled={!!busy} onClick={() => run(v.id, () => reviewVideo(v.id, "APPROVE", notes[v.id] || ""))}>
                        Approve
                      </button>
                      <button className="btn-secondary !py-1.5 text-xs" disabled={!!busy} onClick={() => run(v.id, () => reviewVideo(v.id, "CHANGES", notes[v.id] || ""))}>
                        Ask for changes
                      </button>
                      <button className="btn-ghost !py-1.5 text-xs text-rose-600" disabled={!!busy} onClick={() => run(v.id, () => reviewVideo(v.id, "REJECT", notes[v.id] || ""))}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {waiting.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-black/5 font-semibold">With the creator ({waiting.length})</div>
              <div className="divide-y divide-black/5">
                {waiting.map((v) => (
                  <div key={v.id} className="px-5 py-3 text-sm flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-medium">{v.title}</span>
                      <span className="block text-xs text-black/45">
                        {v.creator} · {v.status === "APPROVED" ? "approved, not posted yet" : "changes requested"} · {day(v.updatedAt)}
                      </span>
                    </span>
                    <Badge variant={STATUS_BADGE[v.status]}>{UGC_STATUS_LABEL[v.status]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "published" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-5 py-3 font-medium">Video</th>
                <th className="px-3 py-3 font-medium">Published</th>
                <th className="px-3 py-3 font-medium">Views</th>
                <th className="px-3 py-3 font-medium text-right">Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {published.map((v) => {
                const age = v.publishedAt ? daysSince(v.publishedAt) : 0;
                return (
                  <tr key={v.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium">{v.title}</div>
                      <div className="text-xs text-black/45">
                        {v.creator}
                        {v.product ? ` · ${v.product}` : ""} ·{" "}
                        {v.postUrl && (
                          <a href={v.postUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                            open post
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-black/60">
                      {v.publishedAt ? day(v.publishedAt) : "—"}
                      <span className="block text-[11px] text-black/40">{age} days ago</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          className={`input !py-1.5 w-28 text-sm ${v.views === null && age >= 14 ? "ring-2 ring-amber-300" : ""}`}
                          inputMode="numeric"
                          placeholder={age < 14 ? `after ${14 - age} d` : "views"}
                          value={views[v.id] ?? (v.views !== null ? String(v.views) : "")}
                          onChange={(e) => setViewsInput({ ...views, [v.id]: e.target.value.replace(/[^\d]/g, "") })}
                        />
                        <button
                          className="btn-secondary !py-1.5 text-xs"
                          disabled={busy === v.id || !(views[v.id] ?? "").length}
                          onClick={() => run(v.id, () => setViews(v.id, Number(views[v.id])))}
                        >
                          Save
                        </button>
                      </div>
                      {v.viewsAt && <div className="text-[11px] text-black/40 mt-1">entered {day(v.viewsAt)}</div>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {eur(v.basePay + v.bonus)}
                      {v.bonus > 0 && <span className="block text-[11px] text-black/40">incl. {eur(v.bonus)} bonus</span>}
                    </td>
                  </tr>
                );
              })}
              {published.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-black/40">No published videos yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ideas" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button className="btn-primary" disabled={busy === "ai" || !props.aiReady} onClick={() => run("ai", generateIdeas)}>
              {busy === "ai" ? "Thinking… (about a minute)" : "✨ Generate this week's ideas with AI"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing({ status: "DRAFT" })}>+ Add idea</button>
            {selected.size > 0 && (
              <>
                <button className="btn-secondary" disabled={!!busy} onClick={() => run("pub", async () => { const r = await setTaskStatus(Array.from(selected), "PUBLISHED"); setSelected(new Set()); return r; })}>
                  Publish {selected.size} selected
                </button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => run("close", async () => { const r = await setTaskStatus(Array.from(selected), "CLOSED"); setSelected(new Set()); return r; })}>
                  Close selected
                </button>
              </>
            )}
          </div>
          {!props.aiReady && (
            <p className="text-xs text-amber-700 mb-3">
              AI ideas need ANTHROPIC_API_KEY in the server variables. Every Monday the daily job also creates draft ideas automatically.
            </p>
          )}
          <div className="card divide-y divide-black/5">
            {props.tasks.length === 0 && <div className="px-5 py-10 text-center text-sm text-black/40">No ideas yet.</div>}
            {props.tasks.map((t) => (
              <div key={t.id} className="px-5 py-3 text-sm flex gap-3 items-start">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(t.id)}
                  onChange={(e) => {
                    const n = new Set(selected);
                    if (e.target.checked) n.add(t.id);
                    else n.delete(t.id);
                    setSelected(n);
                  }}
                />
                <button className="flex-1 text-left min-w-0" onClick={() => setEditing(t)}>
                  <span className="font-medium">{t.title}</span>
                  {t.ai && <span className="ml-2 text-[10px] text-brand-700">AI</span>}
                  <span className="block text-xs text-black/45">
                    {[t.product || "All products", t.theme, t.weekOf && `week of ${day(t.weekOf)}`, t.videos ? `${t.videos} video(s)` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <Badge variant={TASK_BADGE[t.status]}>{t.status === "DRAFT" ? "Draft" : t.status === "PUBLISHED" ? "Published" : "Closed"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "creators" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-5 py-3 font-medium">Creator</th>
                <th className="px-3 py-3 font-medium text-right">Clicks</th>
                <th className="px-3 py-3 font-medium text-right">Leads</th>
                <th className="px-3 py-3 font-medium text-right">Customers</th>
                <th className="px-3 py-3 font-medium text-right">Videos</th>
                <th className="px-3 py-3 font-medium text-right">Views</th>
                <th className="px-5 py-3 font-medium text-right">Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {props.creators.map((c) => (
                <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-black/45">
                      code {c.code}
                      {c.since ? ` · since ${day(c.since)}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {c.clicks}
                    <span className="block text-[11px] text-black/40">{c.clicks30} in 30 d</span>
                  </td>
                  <td className="px-3 py-3 text-right">{c.leads}</td>
                  <td className="px-3 py-3 text-right">{c.won}</td>
                  <td className="px-3 py-3 text-right">{c.published}</td>
                  <td className="px-3 py-3 text-right">{c.views.toLocaleString("sl-SI")}</td>
                  <td className="px-5 py-3 text-right font-medium">{eur(c.earned)}</td>
                </tr>
              ))}
              {props.creators.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-black/40">
                    No creators yet. Sellers join under UGC creator in their CRM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && props.isAdmin && (
        <form className="card p-5 space-y-4 max-w-2xl" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run("settings", () => saveUgcSettings(fd));
          }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Pay per published video (€)</label>
              <input name="ugcVideoPay" className="input" defaultValue={props.settings.pay} />
            </div>
            <div>
              <label className="label">Hours to accept a warm lead</label>
              <input name="warmClaimHours" className="input" defaultValue={props.settings.warmHours} />
            </div>
          </div>
          <div>
            <label className="label">View bonus tiers (views:€, highest reached counts)</label>
            <input name="ugcBonusTiers" className="input" defaultValue={props.settings.tiers} placeholder="10000:10, 40000:25, 100000:50" />
          </div>
          <div>
            <label className="label">Website (creator links go here)</label>
            <input name="websiteUrl" className="input" defaultValue={props.settings.website} />
          </div>
          <div>
            <label className="label">Creator terms (shown when a seller joins)</label>
            <textarea name="ugcTerms" className="input font-mono text-xs" rows={12} defaultValue={props.settings.terms} />
          </div>
          <button className="btn-primary" disabled={busy === "settings"}>Save</button>
        </form>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/50 p-4" onClick={() => setEditing(null)}>
          <form
            className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const r = await run("task", () => saveTask(fd));
              if (r && !r.error) setEditing(null);
            }}
          >
            <h2 className="text-lg font-semibold">{editing.id ? "Edit idea" : "New idea"}</h2>
            {editing.id && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="label">Title</label>
              <input name="title" className="input" defaultValue={editing.title || ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Product</label>
                <select name="productId" className="input" defaultValue={editing.productId || ""}>
                  <option value="">All products</option>
                  {props.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Theme</label>
                <input name="theme" className="input" defaultValue={editing.theme || ""} placeholder="e.g. Christmas" />
              </div>
            </div>
            <div>
              <label className="label">Brief (hook, what to show, call to action)</label>
              <textarea name="brief" className="input" rows={7} defaultValue={editing.brief || ""} />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue={editing.status || "DRAFT"}>
                <option value="DRAFT">Draft (only you see it)</option>
                <option value="PUBLISHED">Published (creators see it)</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="flex justify-between gap-2">
              {editing.id ? (
                <button
                  type="button"
                  className="btn-ghost text-rose-600"
                  onClick={async () => {
                    if (!confirm("Delete this idea?")) return;
                    const r = await run("del", () => deleteTask(editing.id!));
                    if (r && !r.error) setEditing(null);
                  }}
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn-primary" disabled={busy === "task"}>Save</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
