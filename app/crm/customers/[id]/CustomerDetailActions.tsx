"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { PencilIcon, MailIcon, PlusIcon, SendIcon, TrashIcon } from "@/components/icons";
import { updateCustomer, sendIntroEmail, deleteCustomer } from "../actions";
import CustomerForm, { type CustomerFormValues } from "../CustomerForm";
import SendMaterialsModal from "@/app/crm/SendMaterialsModal";
import type { SellerMaterial, SellerTemplate } from "@/lib/seller";
import { fillTemplate } from "@/lib/templates";
import { TEMPLATE_PURPOSE_LABEL } from "@/lib/constants";

export default function CustomerDetailActions({
  customer,
  products,
  materials,
  suggestedMaterialIds,
  templates,
  interestProductIds,
  seller,
}: {
  customer: CustomerFormValues;
  products: { id: string; name: string }[];
  materials: SellerMaterial[];
  suggestedMaterialIds: string[];
  templates: SellerTemplate[];
  interestProductIds: string[];
  seller: { name: string; phone: string | null; hasBookingUrl: boolean };
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [subject, setSubject] = useState("Following up");
  const [body, setBody] = useState(`Hi ${customer.name.split(" ")[0]},\n\n\n\nBest regards,`);

  // Templates for this lead's products first, then general ones.
  const sortedTemplates = [...templates].sort((a, b) => {
    const rank = (t: SellerTemplate) => (t.productId && interestProductIds.includes(t.productId) ? 0 : t.productId ? 2 : 1);
    return rank(a) - rank(b);
  });

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const productName = t.productName || products.find((p) => interestProductIds.includes(p.id))?.name || "";
    const vars = {
      firstName: customer.name.split(" ")[0],
      name: customer.name,
      company: customer.company || customer.name,
      product: productName,
      demoLink: t.demoUrl || "",
      sellerName: seller.name,
      sellerPhone: seller.phone || "",
      // {{bookingLink}} is replaced by the server with a tracked link.
    };
    setSubject(fillTemplate(t.subject, vars));
    setBody(fillTemplate(t.body, vars));
  }

  async function handleUpdate(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await updateCustomer(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setEditOpen(false);
    router.refresh();
  }

  async function handleEmail(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await sendIntroEmail(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setSent(true);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${customer.company || customer.name} and its timeline? This can't be undone.`)) return;
    const result = await deleteCustomer(customer.id);
    if (result && result.error) alert(result.error);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="btn-ghost"
        disabled={!customer.email}
        onClick={() => {
          setError(null);
          setSent(false);
          setEmailOpen(true);
        }}
        title={customer.email ? "Send an email" : "No email on file"}
      >
        <MailIcon className="h-4 w-4" />
        Email
      </button>
      <button className="btn-secondary" onClick={() => setSendOpen(true)}>
        <SendIcon className="h-4 w-4" />
        Send materials
      </button>
      <button
        className="btn-secondary"
        onClick={() => {
          setError(null);
          setEditOpen(true);
        }}
      >
        <PencilIcon className="h-4 w-4" />
        Edit
      </button>
      <Link href={`/crm/quotes/new?customerId=${customer.id}`} className="btn-primary">
        <PlusIcon className="h-4 w-4" />
        New quote
      </Link>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit customer" wide>
        <CustomerForm
          customer={customer}
          products={products}
          busy={busy}
          error={error}
          onSubmit={handleUpdate}
          submitLabel="Save changes"
        />
        <button className="btn-danger w-full mt-3" onClick={handleDelete} type="button">
          <TrashIcon className="h-4 w-4" /> Delete customer
        </button>
      </Modal>

      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title={`Email ${customer.name}`}>
        {sent ? (
          <div className="text-center py-6">
            <div className="text-emerald-600 font-medium mb-1">Email sent</div>
            <p className="text-sm text-black/50">It&apos;s been added to the timeline.</p>
            <button className="btn-secondary mt-4" onClick={() => setEmailOpen(false)}>
              Close
            </button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleEmail(new FormData(e.currentTarget));
            }}
          >
            {error && <div className="error-box">{error}</div>}
            <input type="hidden" name="customerId" value={customer.id} />
            {sortedTemplates.length > 0 && (
              <div>
                <label className="label">Start from a template</label>
                <select className="input" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">— write my own —</option>
                  {sortedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {TEMPLATE_PURPOSE_LABEL[t.purpose]}
                      {t.productName ? ` · ${t.productName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Subject</label>
              <input name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea
                name="message"
                required
                className="input min-h-[200px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-black/40 mt-1">
                <span>Your signature is added automatically.</span>
                {seller.hasBookingUrl ? (
                  <button
                    type="button"
                    className="text-brand-600 hover:underline"
                    onClick={() => setBody((b) => `${b}\n\nPick a time that suits you: {{bookingLink}}`)}
                  >
                    + insert my booking link
                  </button>
                ) : (
                  <span>Add your booking page under Account to insert {"{{bookingLink}}"}.</span>
                )}
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Sending…" : "Send email"}
            </button>
          </form>
        )}
      </Modal>

      <SendMaterialsModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        materials={materials}
        fixedCustomer={{
          id: customer.id,
          name: customer.name,
          company: customer.company,
          email: customer.email,
        }}
        preselected={suggestedMaterialIds.slice(0, 3)}
      />
    </div>
  );
}
