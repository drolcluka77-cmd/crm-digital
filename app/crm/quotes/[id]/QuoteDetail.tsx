"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import {
  DownloadIcon,
  SendIcon,
  TrashIcon,
  CheckCircleIcon,
  XIcon,
  LayersIcon,
} from "@/components/icons";
import { setQuoteStatus, deleteQuote, sendQuoteByEmail, duplicateQuote, getAcceptanceLink } from "../actions";
import { LinkIcon } from "@/components/icons";
import QuoteBuilder, { type BuilderProduct, type LineItem } from "../QuoteBuilder";
import { formatDate, formatMoney } from "@/lib/format";
import { APPROVAL_STATUS_LABEL, BILLING_SUFFIX, QUOTE_STATUS_LABEL } from "@/lib/constants";

export default function QuoteDetail({
  quote,
  products,
  companyName,
  annualNet,
  totalsSummary,
  commissionOverride,
}: {
  quote: {
    id: string;
    number: string;
    status: string;
    customerId: string;
    customerName: string;
    contactName: string;
    customerEmail: string | null;
    sentAt: string | null;
    items: LineItem[];
    discount: number;
    vatRate: number;
    notes: string | null;
    validUntil: string | null;
    approvalStatus: string;
    approvalReason: string | null;
    approvalNote: string | null;
    approvedBy: string | null;
    viewedAt: string | null;
    acceptedByName: string | null;
    acceptedByTitle: string | null;
    declineReason: string | null;
  };
  products: BuilderProduct[];
  commissionOverride: number | null;
  companyName: string;
  annualNet: number;
  totalsSummary: { billing: string; total: number }[];
}) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = quote.status === "ACCEPTED";
  const awaiting = quote.approvalStatus === "PENDING" || quote.approvalStatus === "REJECTED";
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  async function copyLink() {
    setLinkMsg(null);
    const result = await getAcceptanceLink(quote.id);
    if (result && result.error) return setLinkMsg(result.error);
    if (result && result.url) {
      try {
        await navigator.clipboard.writeText(result.url);
        setLinkMsg("Acceptance link copied — paste it in an email or chat.");
      } catch {
        setLinkMsg(result.url);
      }
    }
  }

  async function handleStatus(status: string) {
    setBusy(true);
    const result = await setQuoteStatus(quote.id, status);
    setBusy(false);
    if (result && result.error) return alert(result.error);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete quote ${quote.number}? This can't be undone.`)) return;
    await deleteQuote(quote.id);
  }

  const totalText = totalsSummary
    .map((t) => `${formatMoney(t.total)}${BILLING_SUFFIX[t.billing]}`)
    .join(" + ");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{quote.number}</h1>
            <Badge variant={quote.status}>{QUOTE_STATUS_LABEL[quote.status]}</Badge>
          </div>
          <p className="text-black/50 text-sm mt-1">
            For{" "}
            <Link href={`/crm/customers/${quote.customerId}`} className="hover:text-brand-600 underline-offset-2 hover:underline">
              {quote.customerName}
            </Link>{" "}
            · {formatMoney(annualNet)} first-year value
            {quote.validUntil && ` · valid until ${formatDate(quote.validUntil)}`}
            {quote.sentAt && ` · sent ${formatDate(quote.sentAt)}`}
            {quote.viewedAt && ` · opened by client ${formatDate(quote.viewedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
            <DownloadIcon className="h-4 w-4" />
            PDF
          </a>
          {!locked && !awaiting && quote.status !== "REJECTED" && (
            <button className="btn-secondary" onClick={copyLink} title="Link where the client can accept online">
              <LinkIcon className="h-4 w-4" />
              Acceptance link
            </button>
          )}
          {!locked && !awaiting && (
            <button className="btn-primary" onClick={() => setSendOpen(true)}>
              <SendIcon className="h-4 w-4" />
              {quote.status === "SENT" ? "Send again" : "Send to customer"}
            </button>
          )}
          {quote.status !== "ACCEPTED" && !awaiting && (
            <button className="btn-ghost" disabled={busy} onClick={() => handleStatus("ACCEPTED")}>
              <CheckCircleIcon className="h-4 w-4" />
              Won
            </button>
          )}
          {quote.status !== "REJECTED" && quote.status !== "ACCEPTED" && (
            <button className="btn-ghost" disabled={busy} onClick={() => handleStatus("REJECTED")}>
              <XIcon className="h-4 w-4" />
              Lost
            </button>
          )}
          {locked && (
            <button className="btn-ghost" disabled={busy} onClick={() => handleStatus("SENT")}>
              Reopen
            </button>
          )}
          <button className="btn-ghost" disabled={busy} onClick={() => duplicateQuote(quote.id)} title="Duplicate">
            <LayersIcon className="h-4 w-4" />
          </button>
          {!locked && (
            <button className="btn-danger" onClick={handleDelete}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {linkMsg && <div className="success-box mb-4 break-all">{linkMsg}</div>}
      {quote.approvalStatus !== "NONE" && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            quote.approvalStatus === "APPROVED"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : quote.approvalStatus === "REJECTED"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <div className="font-medium">
            {APPROVAL_STATUS_LABEL[quote.approvalStatus]}
            {quote.approvedBy && quote.approvalStatus !== "PENDING" ? ` by ${quote.approvedBy}` : ""}
          </div>
          {quote.approvalReason && <div className="text-xs mt-0.5">{quote.approvalReason}</div>}
          {quote.approvalNote && <div className="text-xs mt-1 italic">“{quote.approvalNote}”</div>}
          {quote.approvalStatus === "PENDING" && (
            <div className="text-xs mt-1">You can send it and mark it won once your manager approves.</div>
          )}
        </div>
      )}
      {quote.acceptedByName && (
        <div className="success-box mb-4">
          Accepted online by {quote.acceptedByName}
          {quote.acceptedByTitle ? `, ${quote.acceptedByTitle}` : ""}.
        </div>
      )}
      {quote.declineReason && (
        <div className="error-box mb-4">Client&apos;s reason for declining: {quote.declineReason}</div>
      )}
      {locked && (
        <div className="success-box mb-4">
          This quote was accepted, so it&apos;s locked to keep your commission record intact. Reopen it to make
          changes, or duplicate it for an upsell.
        </div>
      )}

      <QuoteBuilder
        key={locked ? "locked" : "open"}
        mode="edit"
        customers={[]}
        products={products}
        defaultVatRate={quote.vatRate}
        readOnly={locked}
        commissionOverride={commissionOverride}
        quote={{
          id: quote.id,
          customerName: quote.customerName,
          items: quote.items,
          discount: quote.discount,
          vatRate: quote.vatRate,
          notes: quote.notes,
          validUntil: quote.validUntil,
        }}
      />

      <SendQuoteModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        quoteId={quote.id}
        quoteNumber={quote.number}
        defaultTo={quote.customerEmail || ""}
        contactName={quote.contactName}
        companyName={companyName}
        totalText={totalText}
        onSent={() => router.refresh()}
      />
    </div>
  );
}

function SendQuoteModal({
  open,
  onClose,
  quoteId,
  quoteNumber,
  defaultTo,
  contactName,
  companyName,
  totalText,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteNumber: string;
  defaultTo: string;
  contactName: string;
  companyName: string;
  totalText: string;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await sendQuoteByEmail(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setSent(true);
    onSent();
  }

  const close = () => {
    setSent(false);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={`Send ${quoteNumber}`}>
      {sent ? (
        <div className="text-center py-6">
          <div className="text-emerald-600 font-medium mb-1">Quote sent</div>
          <p className="text-sm text-black/50">PDF attached. It&apos;s on the customer&apos;s timeline too.</p>
          <button className="btn-secondary mt-4" onClick={close}>
            Close
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          <input type="hidden" name="id" value={quoteId} />
          <div>
            <label className="label">To</label>
            <input
              name="to"
              type="email"
              required
              defaultValue={defaultTo}
              className="input"
              placeholder="customer@email.com"
            />
          </div>
          <div>
            <label className="label">Subject</label>
            <input name="subject" className="input" defaultValue={`Your quote from ${companyName} (${quoteNumber})`} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              name="message"
              required
              className="input min-h-[140px]"
              defaultValue={`Hi ${contactName.split(" ")[0]},\n\nThank you for your time. Please find your quote attached — ${totalText} (incl. VAT). Let me know if you'd like any adjustments, or if we should schedule a call to go through it.\n\nBest regards,`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-black/60">
            <input
              type="checkbox"
              defaultChecked
              onChange={(e) => {
                const hidden = e.currentTarget.form?.elements.namedItem("includeLink") as HTMLInputElement | null;
                if (hidden) hidden.value = e.currentTarget.checked ? "on" : "off";
              }}
            />
            Include a &ldquo;View &amp; accept online&rdquo; button
          </label>
          <input type="hidden" name="includeLink" defaultValue="on" />
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send quote"}
          </button>
        </form>
      )}
    </Modal>
  );
}
