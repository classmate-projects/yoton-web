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
    name: string;
    email: string;
    phone: string;
    address: string;
}

