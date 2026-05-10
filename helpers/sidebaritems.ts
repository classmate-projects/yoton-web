import { appointmentsIcon, contactsIcon, dashboardIcon, registrationIcon } from "@/public/icons";

interface SidebarMenuItem {
    id: number;
    name: string;
    navLink: string;
    roles: string[];
    icon: React.ComponentType; // Assuming icons are React components
}

export const sidebarMenuItems: SidebarMenuItem[] = [
    {
        id: 1,
        name: "Dashboard",
        navLink: "/",
        roles: ["admin", "doctor", "nurse", "receptionist"],
        icon: dashboardIcon
    },

    {
        id: 2,
        name: "Patient Entry",
        navLink: "/patient-entry",
        roles: ["receptionist"],
        icon: registrationIcon
    },

    {
        id: 3,
        name: "Appointments",
        navLink: "/appointments",
        roles: ["admin", "doctor", "nurse", "receptionist"],
        icon: appointmentsIcon
    },

    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        roles: ["admin", "doctor", "nurse"],
        icon: contactsIcon
    }
]