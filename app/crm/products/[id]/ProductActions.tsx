"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayIcon, LinkIcon, SendIcon, PlusIcon } from "@/components/icons";
import SendMaterialsModal from "@/app/crm/SendMaterialsModal";
import type { SellerMaterial } from "@/lib/seller";

export default function ProductActions({
  productId,
  demoUrl,
  websiteUrl,
  materials,
  customers,
  canSell,
}: {
  productId: string;
  demoUrl: string | null;
  websiteUrl: string | null;
  materials: SellerMaterial[];
  customers: { id: string; name: string; company: string | null; email: string | null }[];
  canSell: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sendable = materials.filter((m) => !m.internalOnly);

  return (
    <div className="flex flex-wrap gap-2">
      {demoUrl && (
        <a href={demoUrl} target="_blank" rel="noreferrer" className="btn-primary">
          <PlayIcon className="h-4 w-4" /> Open demo
        </a>
      )}
      {websiteUrl && (
        <a href={websiteUrl} target="_blank" rel="noreferrer" className="btn-secondary">
          <LinkIcon className="h-4 w-4" /> Website
        </a>
      )}
      <button className="btn-secondary" onClick={() => setOpen(true)} disabled={!canSell || sendable.length === 0}>
        <SendIcon className="h-4 w-4" /> Send to a client
      </button>
      {canSell && (
        <Link href={`/crm/quotes/new?productId=${productId}`} className="btn-secondary">
          <PlusIcon className="h-4 w-4" /> Quote
        </Link>
      )}
      <SendMaterialsModal
        open={open}
        onClose={() => setOpen(false)}
        materials={materials}
        customers={customers}
        preselected={sendable.slice(0, 2).map((m) => m.id)}
      />
    </div>
  );
}
