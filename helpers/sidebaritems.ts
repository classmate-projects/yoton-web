import { appointmentsIcon, RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, specializationIcon, doctorIcon } from "@/public/icons/icons";

interface SidebarMenuItem {
    id: number;
    name: string;
    navLink: string;
    roles: string[];
    icon: React.ComponentType; // Assuming icons are React components
}

const allRoles = ["admin", "doctor", "nurse", "lab technician", "radiology technician", "pharmacist", "billing team", "reception"];

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
        roles: ["reception"],
        icon: registrationIcon
    },

    {
        id: 3,
        name: "Appointments",
        navLink: "/appointments",
        roles: ["reception"],
        icon: appointmentsIcon
    },

    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        roles: ["doctor", "nurse", "reception"],
        icon: RecordsIcon
    },

    {
        id: 5,
        name: "User Management",
        navLink: "/user-management",
        roles: ["Admin"],
        icon: multipleUsers
    },

    {
        id: 6,
        name: "Departments",
        navLink: "/departments",
        roles: ["Admin"],
        icon: buildingIcon
    },
    {
        id: 7,
        name: "Specializations",
        navLink: "/specializations",
        roles: ["Admin"],
        icon: specializationIcon
    },
    {
        id: 8,
        name: "Assign Doctor",
        navLink: "/assign-doctor",
        roles: ["Admin"],
        icon: doctorIcon
    },
]