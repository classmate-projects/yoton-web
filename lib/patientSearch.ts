import { PatientGetAllType } from "@/types/reception.type";

// Shared patient-search predicate (Patient Records' lists, the sidebar's quick patient
// search). "Mobile Number" = phone; "MRN" = opNumber (opId itself stays internal - never
// shown to or searched by a user, see the app-wide MRN convention this mirrors).
export const matchesPatientSearch = (p: PatientGetAllType, term: string) => {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return !!(
    p.name?.toLowerCase().includes(q) ||
    p.opNumber?.toLowerCase().includes(q) ||
    p.phone?.toLowerCase().includes(q) ||
    p.nationalID?.toLowerCase().includes(q)
  );
};
