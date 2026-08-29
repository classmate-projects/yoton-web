// Wire shape for a fee-schedule row — deductible/co-pay amounts must be actual JSON
// numbers (the API's decimal? fields aren't configured to parse numbers from strings).
export interface InsuranceCoverageRow {
    serviceCategory: string;
    deductible?: number;
    deductibleAppliesTo?: string;
    coPayPercent?: number;
    coPayMin?: number;
    coPayMax?: number;
    coPayAppliesTo?: string;
}

export interface ReceptionCreatePatientType {
    name: string;
    sex: string;
    dateOfBirth: string;
    phone: string;
    phoneCode: string;
    email: string;
    address: string;
    nationality: string;
    passportNumber: string;
    nationalID: string;
    fatherName: string;
    motherName: string;
    patientType: string;
    visaType: string;
    maritalStatus: string;
    designation: string;
    referralStatus: boolean;
    chronicStatus: boolean;
    emergencyContact: string;
    emergencyContactPhone: string;

    // Payment & Insurance — Cash needs nothing else; Insurance/Corporate share the
    // same eligibility + fee-schedule template.
    paymentType: string;
    eligibilityMode?: string;
    eligibilityCheckedDate?: string;
    eligibilityID?: string;
    eligibilityVisitID?: string;
    insuranceProvider?: string;
    subInsurance?: string;
    networkType?: string;
    insuranceCardNo?: string;
    extraCardNo?: string;
    insuranceEffectiveFrom?: string;
    insuranceExpiryDate?: string;
    certificateNo?: string;
    dependentsNo?: string;
    insuranceClaimNo?: string;
    maxInsuranceLiability?: number;
    insuranceApprovalLimit?: number;
    maxInsuranceCopay?: number;
    coPayPatientPercent?: number;
    insuranceCoverages?: InsuranceCoverageRow[];

    password: string;
    registeredBy: string;
}

export interface PatientGetAllType {
    opId: string;
    // Hospital-assigned outpatient number - what the UI shows as "MRN". opId itself stays
    // internal (routing, FK payloads, React keys) and is never shown to a user.
    opNumber?: string | null;
    name: string;
    email: string;
    phone: string;
    address: string;
    nationalID?: string | null;
    passportNumber?: string | null;
}

// One row per Visit within a date range (Patient Records' "Patient Visit List" toggle) - see
// ReceptionController.GetVisitList. Shares PatientGetAllType's patient-identity fields plus
// the visit's own.
export interface VisitListItemType extends PatientGetAllType {
    visitId: string;
    visitType: string; // Appointment, WalkIn
    status: string; // CheckedIn -> WithNurse -> ... -> Completed
    checkedInAt: string;
}

