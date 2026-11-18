// Shared by server and client components (no server imports here).
export const CANDIDATE_STAGES = ["NEW", "INVITED", "BOOKED", "INTERVIEWED", "ONBOARDING", "HIRED", "REJECTED"] as const;
export const CANDIDATE_STAGE_LABEL: Record<string, string> = {
  NEW: "New",
  INVITED: "Invited",
  BOOKED: "Meeting booked",
  INTERVIEWED: "Interviewed",
  ONBOARDING: "Onboarding",
  HIRED: "Hired",
  REJECTED: "Not selected",
};
export const OPEN_CANDIDATE_STAGES = ["NEW", "INVITED", "BOOKED", "INTERVIEWED", "ONBOARDING"];
