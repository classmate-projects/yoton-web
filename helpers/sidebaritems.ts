import { RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, specializationIcon, doctorIcon, calendarIcon, availableDoctor } from "@/public/icons/icons";

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
        name: "Appointments",
        navLink: "/appointments",
        roles: ["reception"],
        icon: calendarIcon
    },

    {
        id: 3,
        name: "Patient Entry",
        navLink: "/patient-entry",
        roles: ["reception"],
        icon: registrationIcon
    },

    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        roles: ["reception"],
        icon: RecordsIcon
    },

    {
        id: 5,
        name: "User Management",
        navLink: "/user-management",
        roles: ["admin"],
        icon: multipleUsers
    },

    {
        id: 6,
        name: "Departments",
        navLink: "/departments",
        roles: ["admin"],
        icon: buildingIcon
    },
    {
        id: 7,
        name: "Specializations",
        navLink: "/specializations",
        roles: ["admin"],
        icon: specializationIcon
    },
    {
        id: 8,
        name: "Assign Doctor",
        navLink: "/assign-doctor",
        roles: ["admin"],
        icon: doctorIcon
    },
    {
        id: 9,
        name: "Doctors Availability",
        navLink: "/doctor-availability",
        roles: ["reception"],
        icon: availableDoctor
    },
]