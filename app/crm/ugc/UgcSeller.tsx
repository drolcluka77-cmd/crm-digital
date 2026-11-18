"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { UGC_STATUS_LABEL, type BonusTier } from "@/lib/ugc-labels";
import { joinUgc, leaveUgc, submitVideo, markPublished, deleteVideo } from "./actions";

type Task = {
  id: string;
  title: string;
  brief: string | null;
  theme: string | null;
  product: string | null;
  productId: string | null;
  weekOf: string | null;
  videos: number;
  link: string;
};
type Video = {
  id: string;
  title: string;
  status: string;
  product: string | null;
  task: string | null;
  note: string | null;
  reviewNote: string | null;
  hasFile: boolean;
  linkUrl: string | null;
  postUrl: string | null;
  views: number | null;
  basePay: number;
  bonus: number;
  createdAt: string;
  publishedAt: string | null;
};

const eur = (n: number) => n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
const day = (d: string) => new Date(d).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric", year: "numeric" });
const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "SENT",
  CHANGES: "WARN",
  APPROVED: "ACCEPTED",
  REJECTED: "REJECTED",
  PUBLISHED: "WON",
};

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary !py-1.5 !px-3 text-xs"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? "Copied ✓" : label}
    </button>
  );
}

export default function UgcSeller(props: {
  joined: boolean;
  terms: string;
  pay: number;
  tiers: BonusTier[];
  code?: string;
  baseLink?: string;
  links?: { slug: string; label: string; products: string[]; url: string }[];
  products?: { id: string; name: string }[];
  stats?: { clicks: number; clicksMonth: number; leads: number; won: number; earnedMonth: number };
  tasks?: Task[];
  videos?: Video[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [form, setForm] = useState<{ videoId?: string; taskId?: string; title?: string } | null>(null);
  const [postUrl, setPostUrl] = useState<Record<string, string>>({});

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

  const payText = (
    <>
      {eur(props.pay)} for every published video
      {props.tiers.length > 0 && (
        <>
          {" "}+ a view bonus: {props.tiers.map((t) => `${t.views.toLocaleString("sl-SI")}+ views → +${eur(t.bonus)}`).join(", ")}{" "}
          (views 14 days after posting)
        </>
      )}
      .
    </>
  );

  const notice = msg && (
    <div className={`${msg.error ? "error-box" : "success-box"} mb-4`}>{msg.error || msg.success}</div>
  );

  if (!props.joined) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Become a UGC creator</h1>
        <p className="text-black/55 text-sm mt-1 mb-5">
          Record short videos about our products and post them as an Instagram Collab with the Unbusyness profile.
          You get paid per video: {payText}
        </p>
        {notice}
        <div className="card p-5 mb-4">
          <div className="section-title mb-2">How it works</div>
          <ol className="text-sm text-black/70 space-y-1 list-decimal pl-5">
            <li>Pick a video idea (new ones every week) and film it with your phone.</li>
            <li>Upload it here. The sales manager approves it or asks for changes.</li>
            <li>Post the approved video on your Instagram/TikTok as a Collab with Unbusyness, mark it as an ad, and paste the post link here.</li>
            <li>Viewers use your link or your code (first month free) — you see how many come through you.</li>
          </ol>
        </div>
        <div className="card p-5">
          <div className="section-title mb-2">Terms</div>
          <pre className="text-sm text-black/70 whitespace-pre-wrap font-sans max-h-80 overflow-y-auto bg-sand-50 rounded-xl p-4">{props.terms}</pre>
          <label className="flex items-start gap-2 text-sm mt-4">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>I have read and accept the terms (licence to use the videos, consent to use my image and voice, labelling posts as ads, always posting as a Collab).</span>
          </label>
          <button className="btn-primary mt-4" disabled={!agree || busy === "join"} onClick={() => run("join", joinUgc)}>
            {busy === "join" ? "…" : "Accept and become a creator"}
          </button>
        </div>
      </div>
    );
  }

  const videos = props.videos || [];
  const tasks = props.tasks || [];
  const s = props.stats!;
  const open = videos.filter((v) => v.status !== "PUBLISHED" && v.status !== "REJECTED");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">UGC creator</h1>
          <p className="text-black/50 text-sm mt-1">Pay: {payText}</p>
        </div>
        <button className="btn-primary" onClick={() => setForm({})}>+ Submit a video</button>
      </div>
      {notice}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ["Your code", props.code!, "1st month free for the customer"],
          ["Clicks", s.clicks.toLocaleString("sl-SI"), `${s.clicksMonth} this month`],
          ["Leads via you", String(s.leads), `${s.won} became customers`],
          ["Earned this month", eur(s.earnedMonth), "videos + view bonuses"],
        ].map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <div className="text-xs text-black/45">{label}</div>
            <div className="text-xl font-semibold mt-1">{value}</div>
            <div className="text-[11px] text-black/40 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-6">
        <div className="font-semibold mb-1">Your links</div>
        <p className="text-xs text-black/50 mb-3">
          Put the link for your latest video in your bio and stories. Always say your code <strong>{props.code}</strong> in the
          video and write it in the caption — it works even when people type the website themselves.
        </p>
        <div className="space-y-2">
          {(props.links || []).map((l) => (
            <div key={l.slug} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-40 text-black/60">{l.label}</span>
              <code className="bg-sand-50 rounded-lg px-2 py-1 text-xs break-all flex-1 min-w-[200px]">{l.url}</code>
              <Copy text={l.url} />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-40 text-black/60">Code</span>
            <code className="bg-sand-50 rounded-lg px-2 py-1 text-xs flex-1">{props.code}</code>
            <Copy text={props.code!} />
          </div>
        </div>
      </div>

      {open.length > 0 && (
        <div className="card mb-6">
          <div className="px-5 py-4 border-b border-black/5 font-semibold">In progress ({open.length})</div>
          <div className="divide-y divide-black/5">
            {open.map((v) => (
              <div key={v.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{v.title}</span>
                    <span className="block text-xs text-black/40">
                      {[v.product, v.task && `idea: ${v.task}`, `sent ${day(v.createdAt)}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <Badge variant={STATUS_BADGE[v.status]}>{UGC_STATUS_LABEL[v.status]}</Badge>
                </div>
                {v.reviewNote && (
                  <div className="mt-2 rounded-xl bg-amber-50 text-amber-800 px-3 py-2 text-xs whitespace-pre-wrap">
                    <strong>Reviewer:</strong> {v.reviewNote}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  {(v.hasFile || v.linkUrl) && (
                    <a href={`/api/ugc/${v.id}`} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 text-xs">
                      View video
                    </a>
                  )}
                  {v.status === "CHANGES" && (
                    <button className="btn-secondary !py-1.5 text-xs" onClick={() => setForm({ videoId: v.id, title: v.title })}>
                      Upload new version
                    </button>
                  )}
                  {v.status === "APPROVED" && (
                    <>
                      <input
                        className="input !py-1.5 text-xs flex-1 min-w-[220px]"
                        placeholder="Link to your Instagram / TikTok post"
                        value={postUrl[v.id] || ""}
                        onChange={(e) => setPostUrl({ ...postUrl, [v.id]: e.target.value })}
                      />
                      <button
                        className="btn-primary !py-1.5 text-xs"
                        disabled={busy === v.id}
                        onClick={() => run(v.id, () => markPublished(v.id, postUrl[v.id] || ""))}
                      >
                        Mark as published
                      </button>
                    </>
                  )}
                  {(v.status === "SUBMITTED" || v.status === "CHANGES") && (
                    <button
                      className="btn-ghost !py-1.5 text-xs text-rose-600"
                      disabled={busy === `d${v.id}`}
                      onClick={() => confirm("Delete this video?") && run(`d${v.id}`, () => deleteVideo(v.id))}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {v.status === "APPROVED" && (
                  <p className="text-[11px] text-black/45 mt-2">
                    Post it as a <strong>Collab</strong> with the Unbusyness profile (Tag people → Invite collaborator), label it as an ad
                    (paid partnership / #oglas), say your code {props.code} — then paste the post link.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 py-4 border-b border-black/5 font-semibold">Video ideas ({tasks.length})</div>
          {tasks.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-black/40">No ideas published yet — your sales manager adds new ones every week.</div>
          ) : (
            <div className="divide-y divide-black/5">
              {tasks.map((t) => (
                <button key={t.id} className="w-full text-left px-5 py-3 hover:bg-sand-50 text-sm" onClick={() => setTask(t)}>
                  <span className="font-medium">{t.title}</span>
                  <span className="block text-xs text-black/40">
                    {[t.product || "All products", t.theme, t.weekOf && `week of ${day(t.weekOf)}`].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-black/5 font-semibold">Published & closed</div>
          {videos.filter((v) => v.status === "PUBLISHED" || v.status === "REJECTED").length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-black/40">Nothing yet.</div>
          ) : (
            <div className="divide-y divide-black/5">
              {videos
                .filter((v) => v.status === "PUBLISHED" || v.status === "REJECTED")
                .map((v) => (
                  <div key={v.id} className="px-5 py-3 text-sm flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-medium">{v.title}</span>
                      <span className="block text-xs text-black/40">
                        {v.status === "PUBLISHED"
                          ? [
                              v.publishedAt && `published ${day(v.publishedAt)}`,
                              v.views !== null ? `${v.views.toLocaleString("sl-SI")} views` : "views counted after 14 days",
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : v.reviewNote || "Rejected"}
                      </span>
                      {v.postUrl && (
                        <a href={v.postUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                          Open post
                        </a>
                      )}
                    </span>
                    {v.status === "PUBLISHED" ? (
                      <span className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {eur(v.basePay + v.bonus)}
                        {v.bonus > 0 && <span className="block text-[11px] font-normal text-black/40">incl. {eur(v.bonus)} bonus</span>}
                      </span>
                    ) : (
                      <Badge variant="REJECTED">Rejected</Badge>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-xs text-black/40">
        <button className="hover:underline" onClick={() => confirm("Leave the UGC programme? Your link and code will stop working.") && run("leave", leaveUgc)}>
          Leave the UGC programme
        </button>
      </div>

      {task && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/50 p-4" onClick={() => setTask(null)}>
          <div className="card w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-black/45">{[task.product || "All products", task.theme].filter(Boolean).join(" · ")}</div>
            <h2 className="text-lg font-semibold mt-1">{task.title}</h2>
            {task.brief && <p className="text-sm text-black/70 whitespace-pre-wrap mt-3">{task.brief}</p>}
            <div className="mt-4 rounded-xl bg-sand-50 p-3 text-xs text-black/60">
              Link for this video: <code className="break-all">{task.link}</code> · code <strong>{props.code}</strong>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setTask(null)}>Close</button>
              <button
                className="btn-primary"
                onClick={() => {
                  setForm({ taskId: task.id, title: task.title });
                  setTask(null);
                }}
              >
                I filmed it — submit
              </button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/50 p-4" onClick={() => !busy && setForm(null)}>
          <form
            className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const r = await run("submit", () => submitVideo(fd));
              if (r && !r.error) setForm(null);
            }}
          >
            <h2 className="text-lg font-semibold">{form.videoId ? "New version" : "Submit a video"}</h2>
            {form.videoId && <input type="hidden" name="videoId" value={form.videoId} />}
            <div>
              <label className="label">Title</label>
              <input name="title" className="input" defaultValue={form.title || ""} required maxLength={140} />
            </div>
            {!form.videoId && (
              <>
                <div>
                  <label className="label">Video idea</label>
                  <select name="taskId" className="input" defaultValue={form.taskId || ""}>
                    <option value="">— my own idea —</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Product (if it's your own idea)</label>
                  <select name="productId" className="input" defaultValue="">
                    <option value="">—</option>
                    {(props.products || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="label">Video file (up to 48 MB)</label>
              <input type="file" name="file" accept="video/*" className="input" />
              <p className="text-[11px] text-black/40 mt-1">Bigger file? Paste a Google Drive / Dropbox / WeTransfer link instead:</p>
              <input name="linkUrl" className="input mt-1" placeholder="https://…" />
            </div>
            <div>
              <label className="label">Note for the reviewer (optional)</label>
              <textarea name="note" className="input" rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)} disabled={busy === "submit"}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy === "submit"}>
                {busy === "submit" ? "Uploading…" : "Send for review"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
