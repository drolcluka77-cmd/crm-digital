// Client-safe labels for the UGC programme (no database imports).
export const UGC_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Waiting for review",
  CHANGES: "Changes requested",
  APPROVED: "Approved — post it",
  REJECTED: "Rejected",
  PUBLISHED: "Published",
};

export type BonusTier = { views: number; bonus: number };
