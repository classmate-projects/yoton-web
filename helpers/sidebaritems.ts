import { RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, doctorIcon, calendarIcon, availableDoctor } from "@/public/icons/icons";
import { MdPayment } from "react-icons/md";
import { HeartPulse, FlaskConical, ScanLine, Pill, Settings, FileText, Lock, ListPlus, Hash, MessageCircle } from "lucide-react";

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
    icon: React.ComponentType; // Assuming icons are React components
    group: SidebarGroup;
    // Admin-only: when present, clicking this tile (while expanded) drills into these
    // instead of navigating straight to navLink. Leave unset for a plain direct link.
    subItems?: SidebarSubItem[];
}

// Which modules a role can reach is entirely dynamic now - a per-role allow-list managed in
// Role Management and stored server-side (Cli_RoleModulePermissions), synced into
// yoton_user_detail.allowedModules on login and kept live via useRolePermissionsSync. Every
// item below is a candidate module any role (built-in or custom) can be granted, admin always
// implicitly has all of them (see app/(pages)/layout.tsx and components/sidebar.tsx's isAdmin
// checks), and "/settings" plus "/nursing/confidential-notes" are the two permanent exceptions
// that never go through the allow-list at all - see their own entries below.

// Rendered as two labeled sections in the sidebar (see components/sidebar.tsx) —
// item order within each group is display order, so keep related items together.
export const sidebarMenuItems: SidebarMenuItem[] = [
    // ---------------- Configuration ----------------
    {
        id: 1,
        name: "Dashboard",
        navLink: "/",
        icon: dashboardIcon,
        group: "Configuration"
    },
    {
        id: 5,
        name: "User Management",
        navLink: "/user-management",
        icon: multipleUsers,
        group: "Configuration"
    },
    {
        id: 6,
        name: "Departments & Staff",
        navLink: "/departments",
        icon: buildingIcon,
        group: "Configuration",
        subItems: [
            { id: 6, name: "Departments", navLink: "/departments", icon: buildingIcon },
            { id: 8, name: "Assign Doctor", navLink: "/assign-doctor", icon: doctorIcon },
            // Same page as the "Doctors Availability" User Modules tile - the query
            // param is what tells the page to render editable for admin here specifically
            // (see doctor-availability/page.tsx's canEdit check).
            { id: 23, name: "Doctors Availability", navLink: "/doctor-availability?mode=edit", icon: availableDoctor },
        ]
    },
    {
        id: 20,
        name: "Configurable Lists",
        navLink: "/config-lists",
        icon: ListPlus,
        group: "Configuration"
    },
    {
        id: 21,
        name: "ICD Codes",
        navLink: "/icd-codes",
        icon: Hash,
        group: "Configuration"
    },
    // ---------------- User Modules ----------------
    {
        id: 2,
        name: "Appointments",
        navLink: "/appointments",
        icon: calendarIcon,
        group: "User Modules"
    },
    {
        id: 3,
        name: "Patient Entry",
        navLink: "/patient-entry",
        icon: registrationIcon,
        group: "User Modules"
    },
    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        icon: RecordsIcon,
        group: "User Modules"
    },
    {
        id: 11,
        name: "Doctor Workbench",
        navLink: "/doctor",
        icon: doctorIcon,
        group: "User Modules"
    },
    {
        id: 12,
        name: "Nurse Workbench",
        navLink: "/nursing",
        icon: HeartPulse,
        group: "User Modules"
    },
    // Nurse-only and excluded from the allow-list system entirely (see the two hardcoded
    // exemptions in app/(pages)/layout.tsx and components/sidebar.tsx) - NursingController's
    // confidential-note endpoints hard-filter to the creating nurse and refuse even admin, so
    // this can never be a module an admin grants to another role.
    {
        id: 19,
        name: "Confidential Notes",
        navLink: "/nursing/confidential-notes",
        icon: Lock,
        group: "User Modules"
    },
    {
        id: 13,
        name: "Laboratory",
        navLink: "/lab",
        icon: FlaskConical,
        group: "User Modules"
    },
    {
        id: 14,
        name: "Radiology",
        navLink: "/radiology",
        icon: ScanLine,
        group: "User Modules"
    },
    {
        id: 15,
        name: "Pharmacy",
        navLink: "/pharmacy",
        icon: Pill,
        group: "User Modules"
    },
    {
        id: 10,
        name: "Billing",
        navLink: "/billing",
        icon: MdPayment,
        group: "User Modules"
    },
    {
        id: 9,
        name: "Doctors Availability",
        navLink: "/doctor-availability",
        icon: availableDoctor,
        group: "User Modules"
    },
    // Formerly "Doctor Case Sheet"; renamed since it's really a patient's full record, not
    // one doctor's private notes.
    {
        id: 17,
        name: "Electronic Medical Record",
        navLink: "/nursing/case-sheet",
        icon: FileText,
        group: "User Modules"
    },
    {
        id: 22,
        name: "Messages",
        navLink: "/messages",
        icon: MessageCircle,
        group: "User Modules"
    },

    // Always reachable regardless of role or allow-list - see app/(pages)/layout.tsx and
    // components/sidebar.tsx's matching hardcoded "/settings" exemptions, so no role can ever
    // be left with zero reachable pages.
    {
        id: 16,
        name: "Settings",
        navLink: "/settings",
        icon: Settings,
        group: "Configuration"
    },
]
