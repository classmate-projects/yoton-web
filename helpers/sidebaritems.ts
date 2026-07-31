import { RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, specializationIcon, doctorIcon, calendarIcon, availableDoctor } from "@/public/icons/icons";
import { MdPayment } from "react-icons/md";
import { HeartPulse, FlaskConical, ScanLine, Pill } from "lucide-react";

export type SidebarGroup = "User Modules" | "Configuration";

interface SidebarMenuItem {
    id: number;
    name: string;
    navLink: string;
    roles: string[];
    icon: React.ComponentType; // Assuming icons are React components
    group: SidebarGroup;
}

const allRoles = ["admin", "doctor", "nurse", "lab technician", "radiology technician", "pharmacist", "billing team", "reception"];

// Rendered as two labeled sections in the sidebar (see components/sidebar.tsx) —
// item order within each group is display order, so keep related items together.
export const sidebarMenuItems: SidebarMenuItem[] = [
    // ---------------- Configuration ----------------
    {
        id: 1,
        name: "Dashboard",
        navLink: "/",
        roles: allRoles.filter((role) => !["reception", "nurse", "doctor"].includes(role)),
        icon: dashboardIcon,
        group: "Configuration"
    },
    {
        id: 5,
        name: "User Management",
        navLink: "/user-management",
        roles: ["admin"],
        icon: multipleUsers,
        group: "Configuration"
    },
    {
        id: 6,
        name: "Departments",
        navLink: "/departments",
        roles: ["admin"],
        icon: buildingIcon,
        group: "Configuration"
    },
    {
        id: 7,
        name: "Specializations",
        navLink: "/specializations",
        roles: ["admin"],
        icon: specializationIcon,
        group: "Configuration"
    },
    {
        id: 8,
        name: "Assign Doctor",
        navLink: "/assign-doctor",
        roles: ["admin"],
        icon: doctorIcon,
        group: "Configuration"
    },

    // ---------------- User Modules ----------------
    {
        id: 2,
        name: "Appointments",
        navLink: "/appointments",
        roles: ["reception", "admin"],
        icon: calendarIcon,
        group: "User Modules"
    },
    {
        id: 3,
        name: "Patient Entry",
        navLink: "/patient-entry",
        roles: ["reception"],
        icon: registrationIcon,
        group: "User Modules"
    },
    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        roles: ["reception"],
        icon: RecordsIcon,
        group: "User Modules"
    },
    {
        id: 9,
        name: "Doctors Availability",
        navLink: "/doctor-availability",
        roles: ["reception", "admin"],
        icon: availableDoctor,
        group: "User Modules"
    },
    {
        id: 11,
        name: "Doctor Workbench",
        navLink: "/doctor",
        roles: ["doctor", "admin"],
        icon: doctorIcon,
        group: "User Modules"
    },
    {
        id: 12,
        name: "Nurse Workbench",
        navLink: "/nursing",
        roles: ["nurse", "admin"],
        icon: HeartPulse,
        group: "User Modules"
    },
    {
        id: 13,
        name: "Laboratory",
        navLink: "/lab",
        roles: ["admin", "lab technician"],
        icon: FlaskConical,
        group: "User Modules"
    },
    {
        id: 14,
        name: "Radiology",
        navLink: "/radiology",
        roles: ["admin", "radiology technician"],
        icon: ScanLine,
        group: "User Modules"
    },
    {
        id: 15,
        name: "Pharmacy",
        navLink: "/pharmacy",
        roles: ["admin", "pharmacist"],
        icon: Pill,
        group: "User Modules"
    },
    {
        id: 10,
        name: "Billing",
        navLink: "/billing",
        roles: ["admin", "billing team"],
        icon: MdPayment,
        group: "User Modules"
    },
]
