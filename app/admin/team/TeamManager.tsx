"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Badge from "@/components/Badge";
import {
  PlusIcon,
  KeyIcon,
  PencilIcon,
  TrashIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import {
  createUser,
  updateUser,
  toggleUserActive,
  resetUserPassword,
  deleteUser,
  transferCustomers,
} from "./actions";
import { setSellerProducts } from "../access/actions";
import { ROLE_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  isMe: boolean;
  commissionRate: number | null;
  managerId: string | null;
  managerName: string | null;
  customerCount: number;
  quoteCount: number;
  teamSize: number;
  wonValue: number;
  commission: number;
  products: { id: string; name: string; active: boolean }[];
};
type Product = { id: string; name: string; family: string | null; active: boolean };
type ManagerOption = { id: string; name: string };

export default function TeamManager({
  users,
  products,
  managers,
  canManageRoles,
}: {
  users: Member[];
  products: Product[];
  managers: ManagerOption[];
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [productsFor, setProductsFor] = useState<Member | null>(null);
  const [transferFrom, setTransferFrom] = useState<Member | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellers = users.filter((u) => u.role === "SALES");
  const managerList = users.filter((u) => u.role === "MANAGER");
  const admins = users.filter((u) => u.role === "ADMIN");

  async function handleCreate(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await createUser(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setAddOpen(false);
    if (result && result.tempPassword) {
      setCredentials({ email: String(fd.get("email") || ""), password: result.tempPassword });
    }
    router.refresh();
  }

  async function handleUpdate(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await updateUser(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setEditing(null);
    router.refresh();
  }

  async function handleReset(m: Member) {
    if (!confirm(`Reset the password for ${m.name}? A new temporary password will be generated.`)) return;
    const result = await resetUserPassword(m.id);
    if (result && result.error) return alert(result.error);
    if (result && result.tempPassword) setCredentials({ email: m.email, password: result.tempPassword });
  }

  async function handleToggle(m: Member) {
    const result = await toggleUserActive(m.id, !m.active);
    if (result && result.error) return alert(result.error);
    router.refresh();
  }

  async function handleDelete(m: Member) {
    if (!confirm(`Delete ${m.name}? This can't be undone.`)) return;
    const result = await deleteUser(m.id);
    if (result && result.error) return alert(result.error);
    router.refresh();
  }

  const card = (m: Member) => (
    <div key={m.id} className={`card p-5 ${m.active ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{m.name}</span>
            {m.isMe && <Badge variant="INFO">You</Badge>}
            {!m.active && <Badge variant="LOST">Deactivated</Badge>}
          </div>
          <div className="mt-2 space-y-1 text-sm text-black/60">
            <div className="flex items-center gap-2 truncate">
              <MailIcon className="h-3.5 w-3.5 text-black/30 shrink-0" />
              {m.email}
            </div>
            {m.phone && (
              <div className="flex items-center gap-2">
                <PhoneIcon className="h-3.5 w-3.5 text-black/30" />
                {m.phone}
              </div>
            )}
            {m.role === "SALES" && m.commissionRate !== null && (
              <div className="text-xs text-emerald-700">Personal commission: {m.commissionRate}%</div>
            )}
            {m.role === "SALES" && canManageRoles && (
              <div className="flex items-center gap-2 text-xs text-black/45">
                <UsersIcon className="h-3.5 w-3.5 text-black/30" />
                {m.managerName ? `Team: ${m.managerName}` : "No manager"}
              </div>
            )}
          </div>
        </div>
        {m.role === "SALES" && (
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold">{formatMoney(m.wonValue)}</div>
            <div className="text-[11px] text-black/40">won, 1st-year</div>
            {m.commission > 0 && (
              <div className="text-[11px] text-emerald-600 mt-0.5">{formatMoney(m.commission)} commission</div>
            )}
          </div>
        )}
      </div>

      {m.role === "SALES" && (
        <>
          <div className="mt-3 flex items-center gap-3 text-xs text-black/40">
            <span>{m.customerCount} customers</span>·<span>{m.quoteCount} quotes</span>
          </div>
          <div className="mt-3">
            <div className="section-title mb-1.5">Sees products</div>
            <div className="flex flex-wrap gap-1.5">
              {m.products.length === 0 && <span className="text-xs text-black/35">None yet</span>}
              {m.products.map((p) => (
                <Badge key={p.id} variant={p.active ? "INFO" : "MUTED"}>
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
      {m.role === "MANAGER" && (
        <div className="mt-3 text-xs text-black/40">{m.teamSize} sellers on team</div>
      )}

      <div className="mt-4 pt-4 border-t border-black/5 flex flex-wrap gap-1.5">
        {m.role === "SALES" && (
          <button className="btn-secondary" onClick={() => setProductsFor(m)}>
            <ShieldIcon className="h-4 w-4" /> Products
          </button>
        )}
        <button
          className="btn-ghost"
          onClick={() => {
            setError(null);
            setEditing(m);
          }}
        >
          <PencilIcon className="h-4 w-4" /> Edit
        </button>
        <button className="btn-ghost" onClick={() => handleReset(m)}>
          <KeyIcon className="h-4 w-4" /> Password
        </button>
        {m.role === "SALES" && m.customerCount > 0 && (
          <button className="btn-ghost" onClick={() => setTransferFrom(m)}>
            Transfer leads
          </button>
        )}
        {!m.isMe && (
          <button className="btn-ghost" onClick={() => handleToggle(m)}>
            {m.active ? "Deactivate" : "Reactivate"}
          </button>
        )}
        {!m.isMe && (
          <button className="btn-danger ml-auto" onClick={() => handleDelete(m)}>
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{canManageRoles ? "Team" : "My team"}</h1>
          <p className="text-black/50 text-sm mt-1">
            {canManageRoles
              ? "Create accounts for sales managers and sellers, put sellers on a manager's team, and choose the products each seller can sell."
              : "Create seller accounts for your team and choose which products each of them sees."}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setError(null);
            setAddOpen(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          {canManageRoles ? "Add person" : "Add seller"}
        </button>
      </div>

      {canManageRoles && managerList.length > 0 && (
        <Section title="Sales managers">{managerList.map(card)}</Section>
      )}
      <Section title="Sellers">
        {sellers.map(card)}
        {sellers.length === 0 && (
          <div className="card p-10 text-center text-black/40 text-sm md:col-span-2">
            No sellers yet. Add your first one to get started.
          </div>
        )}
      </Section>
      {canManageRoles && <Section title="Admins">{admins.map(card)}</Section>}

      {/* Add */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={canManageRoles ? "Add person" : "Add seller"} wide>
        <PersonForm
          products={products}
          managers={managers}
          canManageRoles={canManageRoles}
          busy={busy}
          error={error}
          onSubmit={handleCreate}
        />
      </Modal>

      {/* Edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        {editing && (
          <PersonForm
            member={editing}
            products={products}
            managers={managers.filter((m) => m.id !== editing.id)}
            canManageRoles={canManageRoles}
            busy={busy}
            error={error}
            onSubmit={handleUpdate}
          />
        )}
      </Modal>

      <SellerProductsModal member={productsFor} products={products} onClose={() => setProductsFor(null)} />

      <TransferModal
        from={transferFrom}
        sellers={sellers.filter((s) => s.active && s.id !== transferFrom?.id)}
        onClose={() => setTransferFrom(null)}
      />

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Login details">
        {credentials && (
          <div className="space-y-4">
            <p className="text-sm text-black/60">
              Share these with {credentials.email} securely. They can change the password once logged in.
            </p>
            <div className="rounded-xl bg-sand-50 border border-black/10 p-4 space-y-2 font-mono text-sm">
              <div>
                <span className="text-black/40">Email: </span>
                {credentials.email}
              </div>
              <div>
                <span className="text-black/40">Password: </span>
                {credentials.password}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => setCredentials(null)}>
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="section-title mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function PersonForm({
  member,
  products,
  managers,
  canManageRoles,
  busy,
  error,
  onSubmit,
}: {
  member?: Member;
  products: Product[];
  managers: ManagerOption[];
  canManageRoles: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (fd: FormData) => void;
}) {
  const [role, setRole] = useState(member?.role || "SALES");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {error && <div className="error-box">{error}</div>}
      {member && <input type="hidden" name="id" value={member.id} />}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Full name</label>
          <input name="name" required defaultValue={member?.name} className="input" placeholder="Ana Novak" />
        </div>
        <div>
          <label className="label">Phone (optional)</label>
          <input name="phone" defaultValue={member?.phone || ""} className="input" placeholder="+386 40 000 000" />
        </div>
      </div>
      <div>
        <label className="label">Email</label>
        <input
          name="email"
          type="email"
          required
          defaultValue={member?.email}
          className="input"
          placeholder="ana@company.com"
        />
      </div>

      {canManageRoles && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input"
              disabled={member?.isMe}
            >
              <option value="SALES">{ROLE_LABEL.SALES}</option>
              <option value="MANAGER">{ROLE_LABEL.MANAGER}</option>
              <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
            </select>
            {member?.isMe && <input type="hidden" name="role" value={role} />}
          </div>
          {role === "SALES" && (
            <div>
              <label className="label">Manager</label>
              <select name="managerId" defaultValue={member?.managerId || ""} className="input">
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {member && canManageRoles && role === "SALES" && (
        <div>
          <label className="label">Personal commission rate (%)</label>
          <input
            name="commissionRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue={member.commissionRate ?? ""}
            className="input"
            placeholder="empty = each product's own rate"
          />
          <p className="text-xs text-black/40 mt-1">Applies to new quote lines; existing quotes keep their rate.</p>
        </div>
      )}

      {!member && role === "SALES" && products.length > 0 && (
        <div>
          <label className="label">Products they can sell</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {products.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 rounded-xl border border-black/10 px-3 py-2 text-sm"
              >
                <input type="checkbox" name="productIds" value={p.id} />
                <span className="truncate">
                  {p.name}
                  {!p.active && <span className="text-black/35"> (hidden)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!member && (
        <p className="text-xs text-black/40">
          A temporary password is generated automatically — you&apos;ll see it after saving.
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : member ? "Save changes" : "Create account"}
      </button>
    </form>
  );
}

function SellerProductsModal({
  member,
  products,
  onClose,
}: {
  member: Member | null;
  products: Product[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(fd: FormData) {
    if (!member) return;
    setBusy(true);
    setError(null);
    const result = await setSellerProducts(member.id, fd.getAll("productIds").map(String));
    setBusy(false);
    if (result && result.error) return setError(result.error);
    onClose();
    router.refresh();
  }

  // Group by family for readability.
  const families = new Map<string, Product[]>();
  for (const p of products) {
    const k = p.family || "Other products";
    if (!families.has(k)) families.set(k, []);
    families.get(k)!.push(p);
  }

  return (
    <Modal open={!!member} onClose={onClose} title={member ? `Products for ${member.name}` : ""}>
      {member && (
        <form
          key={member.id}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          <p className="text-sm text-black/55">
            {member.name.split(" ")[0]} will only see these products — with their plans, prices,
            playbook and materials — in their CRM.
          </p>
          {Array.from(families.entries()).map(([family, list]) => (
            <div key={family}>
              <div className="section-title mb-1.5">{family}</div>
              <div className="space-y-1.5">
                {list.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 rounded-xl border border-black/10 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="productIds"
                      value={p.id}
                      defaultChecked={member.products.some((x) => x.id === p.id)}
                    />
                    {p.name}
                    {!p.active && <span className="text-black/35 text-xs">(hidden by admin)</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Save products"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function TransferModal({
  from,
  sellers,
  onClose,
}: {
  from: Member | null;
  sellers: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);

  async function go() {
    if (!from || !to) return;
    setBusy(true);
    const result = await transferCustomers(from.id, to);
    setBusy(false);
    setMsg(result || { success: "Done." });
    router.refresh();
  }

  return (
    <Modal
      open={!!from}
      onClose={() => {
        setMsg(null);
        setTo("");
        onClose();
      }}
      title={from ? `Transfer ${from.name}'s customers` : ""}
    >
      {from && (
        <div className="space-y-4">
          {msg?.error && <div className="error-box">{msg.error}</div>}
          {msg?.success && <div className="success-box">{msg.success}</div>}
          <p className="text-sm text-black/55">
            Moves all {from.customerCount} customers (with their notes and timeline) to another seller. Quotes
            stay credited to {from.name.split(" ")[0]}.
          </p>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose a seller…</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="btn-primary w-full" disabled={!to || busy} onClick={go}>
            {busy ? "Moving…" : "Transfer customers"}
          </button>
        </div>
      )}
    </Modal>
  );
}
