// Shape written to localStorage["yoton_user_detail"] on login/registration and
// read back by the sidebar for branding (company logo/name, avatar). Other pages
// that only need the role read this same key ad hoc - adding fields here is safe
// for them since they just ignore what they don't use.
export interface CurrentUserDetail {
    role: string;
    name: string;
    userId?: string;
    companyId?: string;
    companyName?: string;
    companyLogoUrl?: string | null;
    userImage?: string | null;
    // navLinks the admin has granted this user's role (see RoleService.setAllowedModules) -
    // absent/empty means this role can reach nothing beyond the permanent "/settings"
    // exemption. Ignored entirely for role === "admin", who always has every module.
    allowedModules?: string[];
    // Admin-configurable in Settings (CompanyController.UpdateSettings) - see lib/currency.ts
    // for the single place every page should read this from rather than hardcoding a symbol.
    currencyCode?: string;
    currencySymbol?: string;
    // Admin-configurable in Settings - the clinic's own home country, used e.g. to decide
    // which National ID format (Emirates ID, Aadhaar, ...) Patient Entry expects, regardless
    // of any individual patient's own nationality. See helpers/nationalIdFormats.ts.
    country?: string;
    // Minutes of inactivity before an auto-logout - same value for every signed-in user,
    // no per-user override. See hooks/useIdleLogout.ts.
    idleTimeoutMinutes?: number;
}

export interface UserType {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    phone: string;
    isActive: boolean;
    createdAt: string;
    lastLogin: string | null;
}

export interface UserCreateType {
    name: string;
    username: string;
    email: string;
    password: string;
    role: string
    phone: string
    gender?: string;
    nationality?: string;
    departmentId?: string;
    hireDate?: string;
}


export interface UserUpdateType {
    name: string;
    email: string;
    role: string;
    phone: string
    isActive: boolean
    gender?: string;
    nationality?: string;
    departmentId?: string;
}

export interface TerminateUserPayload {
    terminationDate: string;
    terminationReason: string;
    terminationReasonOtherText?: string;
}

export interface StaffEmploymentEventType {
    staffEmploymentEventId: string;
    departmentId: string | null;
    departmentName: string | null;
    hireDate: string;
    terminationDate: string | null;
    terminationReason: string | null;
    terminationReasonOtherText: string | null;
}

export interface UserAssignedDoctorCreateType {
    UserId: string;
    SpecializationId: string;
    LicenseNumber: string;
    ExperienceYears: number;
    ConsultationFee: number;
}