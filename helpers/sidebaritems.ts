import { appointmentsIcon, contactsIcon, dashboardIcon, registrationIcon } from "@/public/icons";

interface SidebarMenuItem {
    id: number;
    name: string;
    navLink: string;
    roles: string[];
    icon: React.ComponentType; // Assuming icons are React components
}

const allRoles = ["Admin", "doctor", "nurse", "receptionist"];

export const sidebarMenuItems: SidebarMenuItem[] = [
    {
        id: 1,
        name: "Dashboard",
        navLink: "/",
        roles: allRoles,
        icon: dashboardIcon
    },

    {
        id: 2,
        name: "Patient Entry",
        navLink: "/patient-entry",
        roles: ["receptionist", "Admin"],
        icon: registrationIcon
    },

    {
        id: 3,
        name: "Appointments",
        navLink: "/appointments",
        roles: ["receptionist"],
        icon: appointmentsIcon
    },

    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        roles: ["doctor", "nurse", "receptionist", "Admin"],
        icon: contactsIcon
    },

    {
        id: 5,
        name: "User Management",
        navLink: "/user-management",
        roles: ["Admin"],
        icon: contactsIcon
    }
]