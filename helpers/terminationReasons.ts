// Mirrors Yoton-API's TerminationReasons (Models/StaffEmploymentEvent.cs) - value is what the
// API stores, label is what an admin sees. Shared by User Management's terminate dialog,
// its employment history popup, and the staff detail page.
export const TERMINATION_REASONS = [
  { value: "Retired60Plus", label: "Retired (60+ years)" },
  { value: "EarlyRetirement", label: "Early retirement (<60 years)" },
  { value: "VoluntaryResignation", label: "Left willingly (resignation)" },
  { value: "ForcedTermination", label: "Forced to leave" },
  { value: "Death", label: "Deceased" },
  { value: "TempContractEnded", label: "Temporary/locum contract ended" },
  { value: "TransferredDepartment", label: "Transferred to another department" },
  { value: "Other", label: "Other" },
];

export const terminationReasonLabel = (value: string | null) =>
  TERMINATION_REASONS.find((r) => r.value === value)?.label ?? value;
