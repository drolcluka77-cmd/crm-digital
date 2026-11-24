"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMirrorRun } from "@/lib/mirror-actions";

export default function DeleteRun({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="text-sm text-rose-600 hover:underline"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Izbrišem to analizo? Tega ni mogoče razveljaviti.")) return;
        setBusy(true);
        await deleteMirrorRun(id);
        router.push("/admin/mirror");
        router.refresh();
      }}
    >
      {busy ? "Brišem …" : "Izbriši analizo"}
    </button>
  );
}
