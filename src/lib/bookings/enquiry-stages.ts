/** The open stages of an enquiry, in pipeline order. WON and LOST are set when it closes. */
export const ENQUIRY_STAGES = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "PROPOSAL_SENT", label: "Proposal sent" },
] as const;
