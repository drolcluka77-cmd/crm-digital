"use client";

import { XIcon } from "@/components/icons";

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
      onClick={onClose}
    >
      <div
        className={`card w-full ${
          wide ? "max-w-2xl" : "max-w-md"
        } max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            type="button"
            className="text-black/40 hover:text-black/70"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
