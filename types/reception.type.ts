export interface ReceptionCreatePatient {
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
    password: string;
    registeredBy: string;
}