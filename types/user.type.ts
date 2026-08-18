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
    // navLinks the admin has hidden from this user's role (see RoleService.setHiddenModules) -
    // absent/empty means nothing is restricted beyond the baseline roles[] on each sidebar item.
    hiddenModules?: string[];
    // Admin-configurable in Settings (CompanyController.UpdateSettings) - see lib/currency.ts
    // for the single place every page should read this from rather than hardcoding a symbol.
    currencyCode?: string;
    currencySymbol?: string;
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
}


export interface UserUpdateType {
    name: string;
    email: string;
    role: string;
    phone: string
    isActive: boolean
}

export interface UserAssignedDoctorCreateType {
    UserId: string;
    SpecializationId: string;
    LicenseNumber: string;
    ExperienceYears: number;
    ConsultationFee: number;
}