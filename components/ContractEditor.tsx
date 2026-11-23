"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import {
  cancelContract,
  deleteContract,
  markContractPaid,
  createPaymentLink,
  regenerateContract,
  reviewContract,
  saveContract,
  sendContract,
  submitContractForReview,
} from "@/lib/contract-actions";
import { useT } from "@/components/LocaleProvider";

export type ContractView = {
  id: string;
  /** Changes whenever the contract is saved — remounts the form so it shows the saved text. */
  version: string;
  number: string;
  status: string;
  statusLabel: string;
  title: string;
  body: string;
  clientCompany: string | null;
  clientAddress: string | null;
  clientRegNo: string | null;
  clientVatId: string | null;
  clientRepresentative: string | null;
  clientEmail: string | null;
  customerId: string;
  customerName: string;
  quoteId: string;
  quoteNumber: string;
  sellerName: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedName: string | null;
  signedTitle: string | null;
  signedAt: string | null;
  signedIp: string | null;
  documentHash: string | null;
  proformaNumber: string | null;
  proformaDueAt: string | null;
  proformaTotal: string | null;
  paidAt: string | null;
  paymentLinkUrl: string | null;
  revolut: boolean;
  signingLink: string | null;
  problems: string[];
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" }) : "");

export default function ContractEditor({
  c,
  role,
  reviewRequired,
  customerHref,
  quoteHref,
}: {
  c: ContractView;
  role: string;
  reviewRequired: boolean;
  customerHref: string | null;
  quoteHref: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const staff = role === "ADMIN" || role === "MANAGER";
  const editable = c.status === "DRAFT" || c.status === "IN_REVIEW" || c.status === "APPROVED";
  const canSend =
    c.status === "APPROVED" || (c.status === "DRAFT" && (staff || !reviewRequired)) || (c.status === "IN_REVIEW" && staff);

  async function run(key: string, fn: () => Promise<any>, after?: (r: any) => void) {
    setBusy(key);
    setMsg(null);
    const r = await fn();
    setBusy(null);
    setMsg(r || null);
    if (!r?.error) {
      setDirty(false);
      after?.(r);
    }
    router.refresh();
  }

  function formData() {
    return new FormData(document.getElementById("contract-form") as HTMLFormElement);
  }

  async function saveThen(key: string, fn: () => Promise<any>) {
    if (editable && dirty) {
      setBusy(key);
      const r = await saveContract(c.id, formData());
      if (r?.error) {
        setBusy(null);
        setMsg(r);
        return;
      }
    }
    await run(key, fn);
  }

  const statusVariant = c.status === "SIGNED" ? "WON" : c.status === "CANCELLED" ? "LOST" : c.status === "IN_REVIEW" ? "WARN" : "MUTED";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t("Contract ")}{c.number}</h1>
            <Badge variant={statusVariant as any}>{c.statusLabel}</Badge>
          </div>
          <div className="text-sm text-black/50 mt-1">
            {customerHref ? <Link href={customerHref} className="underline">{c.customerName}</Link> : c.customerName}
            {" · "}{t("from quote ")}{quoteHref ? <Link href={quoteHref} className="underline">{c.quoteNumber}</Link> : c.quoteNumber}
            {" · "}{t("seller ")}{c.sellerName}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/contracts/${c.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">{t("PDF")}</a>
          {c.proformaNumber && (
            <a href={`/api/contracts/${c.id}/predracun`} target="_blank" rel="noreferrer" className="btn-secondary">
              {t("Proforma ")}{c.proformaNumber}
            </a>
          )}
        </div>
      </div>

      {msg?.error && <div className="error-box mb-4">{t(msg.error)}</div>}
      {msg?.success && <div className="success-box mb-4 break-all">{t(msg.success)}</div>}

      {c.reviewNote && c.status === "DRAFT" && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm bg-amber-50 border-amber-200 text-amber-800">
          <div className="font-medium">{t("Changes requested")}{c.reviewedBy ? ` by ${c.reviewedBy}` : ""}</div>
          <div className="mt-0.5 whitespace-pre-wrap">{c.reviewNote}</div>
        </div>
      )}
      {c.status === "APPROVED" && (
        <div className="success-box mb-4">
          {t("Approved")}{c.reviewedBy ? ` by ${c.reviewedBy}` : ""}{t(". You can send it for signature.")}
          {c.reviewNote ? ` Note: “${c.reviewNote}”` : ""}
        </div>
      )}
      {c.status === "IN_REVIEW" && !staff && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm bg-amber-50 border-amber-200 text-amber-800">
          {t("Waiting for your manager's review. You'll get a notification.")}
        </div>
      )}
      {editable && c.problems.length > 0 && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm bg-amber-50 border-amber-200 text-amber-800">
          <div className="font-medium">{t("Before it can be sent")}</div>
          <ul className="list-disc pl-5 mt-1">
            {c.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Status-specific actions */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-2">
        {c.status === "DRAFT" && reviewRequired && !staff && (
          <button className="btn-primary" disabled={!!busy} onClick={() => saveThen("review", () => submitContractForReview(c.id))}>
            {busy === "review" ? t("Sending…") : t("Send for review")}
          </button>
        )}
        {staff && (c.status === "IN_REVIEW" || c.status === "DRAFT") && (
          <>
            <input
              className="input flex-1 min-w-[200px]"
              placeholder={t("Note for the seller (optional)")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn-primary" disabled={!!busy} onClick={() => saveThen("approve", () => reviewContract(c.id, true, note))}>
              {busy === "approve" ? t("Approving…") : t("Approve")}
            </button>
            {c.status === "IN_REVIEW" && (
              <button className="btn-secondary" disabled={!!busy} onClick={() => run("back", () => reviewContract(c.id, false, note))}>
                {t("Request changes")}
              </button>
            )}
          </>
        )}
        {canSend && (
          <button
            className={c.status === "APPROVED" ? "btn-primary" : "btn-secondary"}
            disabled={!!busy}
            onClick={() => {
              if (!confirm(`Send contract ${c.number} for signature to ${c.clientEmail || "the client"}?`)) return;
              saveThen("send", () => sendContract(c.id));
            }}
          >
            {busy === "send" ? t("Sending…") : t("Send for signature")}
          </button>
        )}
        {c.status === "SENT" && (
          <>
            <div className="text-sm text-black/60">
              {t("Sent ")}{fmt(c.sentAt)}{t(" to ")}{c.clientEmail}
              {c.viewedAt ? ` · opened ${fmt(c.viewedAt)}` : t(" · not opened yet")}
            </div>
            <span className="flex-1" />
            {c.signingLink && (
              <button
                className="btn-secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(c.signingLink!);
                  setMsg({ success: `Signing link copied: ${c.signingLink}` });
                }}
              >
                {t("Copy signing link")}
              </button>
            )}
            <button className="btn-secondary" disabled={!!busy} onClick={() => run("send", () => sendContract(c.id))}>
              {t("Send again")}
            </button>
          </>
        )}
        {c.status === "SIGNED" && (
          <div className="text-sm space-y-0.5">
            <div className="font-medium text-emerald-700">
              {t("✅ Signed by ")}{c.signedName}
              {c.signedTitle ? `, ${c.signedTitle}` : ""} · {fmt(c.signedAt)}
            </div>
            <div className="text-black/55">
              {t("Proforma ")}{c.proformaNumber}: <b>{c.proformaTotal}</b>
              {c.proformaDueAt ? `, due ${new Date(c.proformaDueAt).toLocaleDateString("sl-SI")}` : ""} ·{" "}
              {c.paidAt ? <span className="text-emerald-700 font-medium">{t("paid ")}{fmt(c.paidAt)}</span> : t("not paid yet")}
            </div>
            <div className="text-xs text-black/40 break-all">{t("IP ")}{c.signedIp}{t(" · SHA-256 ")}{c.documentHash}</div>
          </div>
        )}
        {c.status === "SIGNED" && !c.paidAt && (
          <>
            <span className="flex-1" />
            {c.paymentLinkUrl ? (
              <button
                className="btn-secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(c.paymentLinkUrl!);
                  setMsg({ success: `Card payment link copied: ${c.paymentLinkUrl}` });
                }}
              >
                {t("Copy payment link")}
              </button>
            ) : (
              c.revolut && (
                <button className="btn-secondary" disabled={!!busy} onClick={() => run("paylink", () => createPaymentLink(c.id))}>
                  {busy === "paylink" ? t("Creating…") : t("Create card payment link")}
                </button>
              )
            )}
          </>
        )}
        {c.status === "SIGNED" && staff && (
          <>
            <button className="btn-secondary" disabled={!!busy} onClick={() => run("paid", () => markContractPaid(c.id, !c.paidAt))}>
              {c.paidAt ? t("Mark as unpaid") : t("Mark as paid")}
            </button>
          </>
        )}
        {(c.status === "DRAFT" || c.status === "IN_REVIEW" || c.status === "APPROVED" || c.status === "SENT") && (
          <>
            <span className="flex-1" />
            <button
              className="btn-ghost text-rose-700"
              disabled={!!busy}
              onClick={() => {
                if (confirm("Cancel this contract? The signing link stops working.")) run("cancel", () => cancelContract(c.id));
              }}
            >
              {t("Cancel contract")}
            </button>
          </>
        )}
        {c.status === "CANCELLED" && (
          <button
            className="btn-danger"
            disabled={!!busy}
            onClick={() => {
              if (confirm("Delete this contract? You can then create a new one from the quote."))
                run("del", () => deleteContract(c.id), () => router.push(quoteHref || "/"));
            }}
          >
            {t("Delete")}
          </button>
        )}
      </div>

      <form
        key={c.version}
        id="contract-form"
        className="grid lg:grid-cols-[320px_1fr] gap-5"
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          run("save", () => saveContract(c.id, new FormData(e.currentTarget)));
        }}
      >
        <div className="card p-5 space-y-3 h-fit">
          <div className="section-title">{t("Client on the contract")}</div>
          <Field label={t("Company")} name="clientCompany" value={c.clientCompany} disabled={!editable} />
          <Field label={t("Address (street, post code and town)")} name="clientAddress" value={c.clientAddress} disabled={!editable} placeholder={t("Slovenska cesta 1, 1000 Ljubljana")} />
          <Field label={t("Registration no. (matična)")} name="clientRegNo" value={c.clientRegNo} disabled={!editable} />
          <Field label={t("Tax / VAT no. (davčna / ID za DDV)")} name="clientVatId" value={c.clientVatId} disabled={!editable} />
          <Field label={t("Signs for the client (name, role)")} name="clientRepresentative" value={c.clientRepresentative} disabled={!editable} placeholder={t("Ana Novak, direktorica")} />
          <Field label={t("E-mail for signing")} name="clientEmail" value={c.clientEmail} disabled={!editable} type="email" />
          <p className="text-xs text-black/40">
            {t("Look the company up on bizi.si or ajpes.si. After changing these, use “Rebuild text” so the contract picks them up.")}
          </p>
        </div>
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <Field label={t("Title")} name="title" value={c.title} disabled={!editable} />
          </div>
          <textarea
            name="body"
            defaultValue={c.body}
            readOnly={!editable}
            rows={32}
            className="input font-mono text-[12.5px] leading-relaxed"
          />
          {editable && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-primary" disabled={!!busy}>{busy === "save" ? t("Saving…") : dirty ? t("Save changes") : t("Save")}</button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!!busy}
                onClick={() => {
                  if (confirm("Rebuild the text from the template with the client details? Manual edits to the text are lost."))
                    run("regen", () => regenerateContract(c.id, formData()));
                }}
              >
                {busy === "regen" ? t("Rebuilding…") : t("Rebuild text")}
              </button>
              {c.status === "APPROVED" && !staff && reviewRequired && (
                <span className="text-xs text-black/45 self-center">{t("Saving changes sends it back for review.")}</span>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  disabled,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string | null;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="text-sm block w-full">
      <span className="label">{label}</span>
      <input name={name} type={type} defaultValue={value || ""} disabled={disabled} placeholder={placeholder} className="input" />
    </label>
  );
}
