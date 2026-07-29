import { RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, specializationIcon, doctorIcon, calendarIcon, availableDoctor } from "@/public/icons/icons";
import { MdPayment } from "react-icons/md";
import { HeartPulse, FlaskConical, ScanLine, Pill } from "lucide-react";

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
        roles: allRoles.filter((role) => role !== "reception"),
        icon: dashboardIcon
    },

    {
        id: 5,
        name: "User Management",
        navLink: "/user-management",
        roles: ["admin"],
        icon: multipleUsers
    },
    
    {
        id: 2,
        name: "Appointments",
        navLink: "/appointments",
        roles: ["reception", "admin"],
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
        roles: ["reception", "admin"],
        icon: availableDoctor
    },
    {
        id: 10,
        name: "Billing",
        navLink: "/billing",
        roles: ["admin", "billing team"],
        icon: MdPayment
    },
    {
        id: 11,
        name: "Doctor Workbench",
        navLink: "/doctor",
        roles: ["doctor", "admin"],
        icon: doctorIcon
    },
    {
        id: 12,
        name: "Nurse Workbench",
        navLink: "/nursing",
        roles: ["nurse", "admin"],
        icon: HeartPulse
    },
    {
        id: 13,
        name: "Laboratory",
        navLink: "/lab",
        roles: ["admin", "lab technician"],
        icon: FlaskConical
    },
    {
        id: 14,
        name: "Radiology",
        navLink: "/radiology",
        roles: ["admin", "radiology technician"],
        icon: ScanLine
    },
    {
        id: 15,
        name: "Pharmacy",
        navLink: "/pharmacy",
        roles: ["admin", "pharmacist"],
        icon: Pill
    }
]