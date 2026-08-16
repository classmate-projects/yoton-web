import { RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, specializationIcon, doctorIcon, calendarIcon, availableDoctor } from "@/public/icons/icons";
import { MdPayment } from "react-icons/md";
import { HeartPulse, FlaskConical, ScanLine, Pill, Settings, FileText, Lock, ListPlus, Hash, MessageCircle, ClipboardList } from "lucide-react";

export type SidebarGroup = "User Modules" | "Configuration";

export interface SidebarSubItem {
    id: number;
    name: string;
    navLink: string;
    icon: React.ComponentType;
}

export interface SidebarMenuItem {
    id: number;
    name: string;
    navLink: string; // default/direct page - used when collapsed, and when the item has no subItems
    roles: string[];
    icon: React.ComponentType; // Assuming icons are React components
    group: SidebarGroup;
    // Admin-only: when present, clicking this tile (while expanded) drills into these
    // instead of navigating straight to navLink. Leave unset for a plain direct link.
    subItems?: SidebarSubItem[];
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
        name: "Departments & Staff",
        navLink: "/departments",
        roles: ["admin"],
        icon: buildingIcon,
        group: "Configuration",
        subItems: [
            { id: 6, name: "Departments", navLink: "/departments", icon: buildingIcon },
            { id: 7, name: "Specializations", navLink: "/specializations", icon: specializationIcon },
            { id: 8, name: "Assign Doctor", navLink: "/assign-doctor", icon: doctorIcon },
        ]
    },
    {
        id: 20,
        name: "Configurable Lists",
        navLink: "/config-lists",
        roles: ["admin"],
        icon: ListPlus,
        group: "Configuration"
    },
    {
        id: 21,
        name: "ICD Codes",
        navLink: "/icd-codes",
        roles: ["admin"],
        icon: Hash,
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
        // Doctor included: read-only view of nursing charting for their patients (see
        // NursingController — write endpoints there stay locked to admin/nurse, and
        // nursing/page.tsx hides every write form/button when the viewer is a doctor).
        // "Doctor Workbench" (declared above, id 11) still wins firstAllowedRoute() for a
        // doctor's post-login landing page since array order is unchanged.
        roles: ["nurse", "admin", "doctor"],
        icon: HeartPulse,
        group: "User Modules"
    },
    // Order here no longer matters for access control — matchRoute() in
    // app/(pages)/layout.tsx picks the most specific (longest navLink) match, not the
    // first array match — but firstAllowedRoute() DOES still use array order to pick a
    // nurse's post-login landing page, so Nurse Workbench (above) must stay first among
    // nurse-accessible entries.
    {
        id: 17,
        name: "Doctor Case Sheet",
        navLink: "/nursing/case-sheet",
        roles: ["nurse", "admin"],
        icon: FileText,
        group: "User Modules"
    },
    {
        id: 18,
        name: "Doctor Investigations",
        navLink: "/nursing/investigations",
        roles: ["nurse", "admin"],
        icon: ClipboardList,
        group: "User Modules"
    },
    {
        id: 19,
        name: "Confidential Notes",
        navLink: "/nursing/confidential-notes",
        roles: ["nurse"],
        icon: Lock,
        group: "User Modules"
    },
    {
        id: 13,
        name: "Laboratory",
        navLink: "/lab",
        // Doctor included: LabController's class-level [Authorize] already permits
        // "doctor" (read + order placement) — this just surfaces the existing access.
        roles: ["admin", "lab technician", "doctor"],
        icon: FlaskConical,
        group: "User Modules"
    },
    {
        id: 14,
        name: "Radiology",
        navLink: "/radiology",
        // Doctor included: RadiologyController's class-level [Authorize] already
        // permits "doctor" (read + order placement) — this just surfaces the existing access.
        roles: ["admin", "radiology technician", "doctor"],
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
    {
        id: 22,
        name: "Messages",
        navLink: "/messages",
        // Every staff role - "web users chat with each other" has no role restriction.
        roles: allRoles,
        icon: MessageCircle,
        group: "User Modules"
    },

    // Deliberately declared last: firstAllowedRoute() (app/(pages)/layout.tsx)
    // picks the first array match for the user's role, and every role can see
    // Settings — placing it early would win that race and land every non-admin
    // role on Settings after login instead of their actual work module.
    {
        id: 16,
        name: "Settings",
        navLink: "/settings",
        roles: allRoles,
        icon: Settings,
        group: "Configuration"
    },
]
