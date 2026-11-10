// Allowed values for the string "enum" columns in prisma/schema.prisma,
// plus their human labels. Import from here instead of hard-coding.

export type Role = "ADMIN" | "MANAGER" | "SALES";
export const ROLES: Role[] = ["ADMIN", "MANAGER", "SALES"];
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Sales manager",
  SALES: "Seller",
};

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "DEMO_SCHEDULED",
  "DEMO_DONE",
  "QUOTE_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "New lead",
  CONTACTED: "Contacted",
  DEMO_SCHEDULED: "Demo scheduled",
  DEMO_DONE: "Demo done",
  QUOTE_SENT: "Quote sent",
  NEGOTIATION: "Negotiating",
  WON: "Won",
  LOST: "Lost",
};
export const OPEN_LEAD_STATUSES = LEAD_STATUSES.filter((s) => s !== "WON" && s !== "LOST");

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

export type Billing = "ONE_TIME" | "MONTHLY" | "YEARLY";
export const BILLINGS: Billing[] = ["ONE_TIME", "MONTHLY", "YEARLY"];
export const BILLING_LABEL: Record<string, string> = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};
/** Short suffix after a price: "€49 / month". */
export const BILLING_SUFFIX: Record<string, string> = {
  ONE_TIME: "",
  MONTHLY: " / month",
  YEARLY: " / year",
};
/** How many times a line is charged in the first year. */
export const BILLING_ANNUAL_FACTOR: Record<string, number> = {
  ONE_TIME: 1,
  MONTHLY: 12,
  YEARLY: 1,
};

export const MATERIAL_TYPES = [
  "PRESENTATION",
  "DEMO_VIDEO",
  "DEMO_LINK",
  "ONE_PAGER",
  "PRICE_LIST",
  "CASE_STUDY",
  "CONTRACT",
  "SALES_SCRIPT",
  "OTHER",
] as const;
export const MATERIAL_TYPE_LABEL: Record<string, string> = {
  PRESENTATION: "Presentation",
  DEMO_VIDEO: "Demo video",
  DEMO_LINK: "Live demo",
  ONE_PAGER: "One-pager / brochure",
  PRICE_LIST: "Price list",
  CASE_STUDY: "Case study",
  CONTRACT: "Contract / terms",
  SALES_SCRIPT: "Sales script (internal)",
  OTHER: "Other",
};

export const ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "MEETING",
  "DEMO",
  "EMAIL",
  "MATERIALS_SENT",
  "MATERIAL_VIEWED",
  "QUOTE_SENT",
  "QUOTE_ACCEPTED",
  "QUOTE_REJECTED",
  "STATUS_CHANGE",
] as const;
/** Activity types a seller can log by hand. */
export const MANUAL_ACTIVITY_TYPES = ["NOTE", "CALL", "MEETING", "DEMO", "EMAIL"] as const;
/** Activity types that count as "we were in touch" (updates lastContactAt). */
export const CONTACT_ACTIVITY_TYPES = ["CALL", "MEETING", "DEMO", "EMAIL", "MATERIALS_SENT", "QUOTE_SENT", "DEMO_BOOKED"];
export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  MEETING: "Meeting",
  DEMO: "Demo",
  EMAIL: "Email",
  MATERIALS_SENT: "Materials sent",
  MATERIAL_VIEWED: "Client opened material",
  QUOTE_SENT: "Quote sent",
  QUOTE_ACCEPTED: "Quote accepted",
  QUOTE_REJECTED: "Quote rejected",
  STATUS_CHANGE: "Status changed",
  BOOKING_OPENED: "Client opened booking link",
  DEMO_BOOKED: "Demo booked",
  QUOTE_VIEWED: "Client viewed quote",
  SUBSCRIPTION: "Subscription",
  LEAD_ASSIGNED: "Lead assigned",
};

// Suggestions shown in free-text fields (users can type anything).
export const SEGMENT_SUGGESTIONS = [
  "Building / property management",
  "Homeowners association",
  "Trades / contractor",
  "Hotel",
  "Hospital",
  "Clinic / healthcare",
  "Elderly care home",
  "Facility management",
  "Real estate",
  "Other",
];
export const SOURCE_SUGGESTIONS = [
  "Cold call",
  "Referral",
  "Website / inbound",
  "LinkedIn",
  "Email campaign",
  "Event / trade fair",
  "Partner",
  "Existing customer",
];

export const ACCENT_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#0f172a",
];

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  NONE: "No approval needed",
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  REJECTED: "Approval declined",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
};

export const TEMPLATE_PURPOSES = ["FIRST_CONTACT", "FOLLOW_UP", "AFTER_DEMO", "PROPOSAL", "OTHER"] as const;
export const TEMPLATE_PURPOSE_LABEL: Record<string, string> = {
  FIRST_CONTACT: "First contact",
  FOLLOW_UP: "Follow-up",
  AFTER_DEMO: "After demo",
  PROPOSAL: "Proposal / quote",
  OTHER: "Other",
};
export const TEMPLATE_PLACEHOLDERS: [string, string][] = [
  ["{{firstName}}", "Client's first name"],
  ["{{name}}", "Client's full name"],
  ["{{company}}", "Client's company"],
  ["{{product}}", "Product name"],
  ["{{demoLink}}", "Product demo link"],
  ["{{bookingLink}}", "Tracked link to the seller's booking page"],
  ["{{sellerName}}", "Seller's name"],
  ["{{sellerPhone}}", "Seller's phone"],
];

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  MATERIAL_VIEWED: "Material opened",
  BOOKING_OPENED: "Booking link opened",
  DEMO_BOOKED: "Demo booked",
  QUOTE_VIEWED: "Quote viewed",
  QUOTE_ACCEPTED: "Quote accepted",
  QUOTE_DECLINED: "Quote declined",
  APPROVAL_REQUESTED: "Approval requested",
  APPROVAL_DECIDED: "Approval decision",
  LEADS_ASSIGNED: "New leads",
  PAYOUT: "Commission paid",
  CERTIFIED: "Certification",
  RENEWAL_DUE: "Renewal due",
};
