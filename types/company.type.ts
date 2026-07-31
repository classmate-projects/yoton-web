export interface RegisterCompanyPayload {
    name: string;
    contactEmail: string;
    contactPhone?: string;
    address?: string;
    adminName: string;
    adminUsername: string;
    adminEmail: string;
    adminPassword: string;
    adminPhone?: string;
}
