import { RecordsIcon, dashboardIcon, registrationIcon, multipleUsers, buildingIcon, doctorIcon, calendarIcon, availableDoctor } from "@/public/icons/icons";
import { MdPayment } from "react-icons/md";
import type { RegionFeature } from "@/types/region.type";
import { HeartPulse, FlaskConical, ScanLine, Pill, Settings, FileText, Lock, ListPlus, MessageCircle, FileSpreadsheet, AlertTriangle, ShieldAlert, Droplets, Smile, ShieldCheck, ScrollText, ClipboardList, UserCheck } from "lucide-react";

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
    // A country-only module: hidden everywhere (sidebar, route guard, role permissions) unless
    // the installation's region has this feature - see lib/region.ts. The API refuses it
    // too ([RequireRegionFeature]).
    regionFeature?: RegionFeature;
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

    // HSPA-2 compliance KPI reports (see Services/Reports/ on the API side) - a normal
    // admin-grantable module, not a permanent exemption. Qatar (MoPH) only.
    {
        id: 25,
        name: "Reports",
        navLink: "/reports/kpi",
        icon: FileSpreadsheet,
        group: "Configuration",
        regionFeature: "qualityKpiReports"
    },

    // Sentinel Events / Medication Errors / Dental Errors reporting - a normal
    // admin-grantable module, feeds the PL4.3/PL4.4/PL4.7 KPI reports.
    {
        id: 26,
        name: "Clinical Incidents",
        navLink: "/incident-reports/clinical",
        icon: AlertTriangle,
        group: "User Modules"
    },
    // Fully separate from Clinical Incidents (staff, not a patient, is the subject) - feeds
    // the PL4.2 KPI report.
    {
        id: 27,
        name: "Staff Exposure",
        navLink: "/incident-reports/staff-exposure",
        icon: ShieldAlert,
        group: "User Modules"
    },
    // Feeds the PL4.1 KPI report.
    {
        id: 28,
        name: "Hand Hygiene Audit",
        navLink: "/hand-hygiene",
        icon: Droplets,
        group: "User Modules"
    },
    // Feeds the PL5.1 KPI report.
    {
        id: 29,
        name: "Patient Satisfaction",
        navLink: "/patient-satisfaction",
        icon: Smile,
        group: "User Modules"
    },

    // Closes KPI regulatory data gaps that have no other source in the EMR (staff FTE for
    // PL4.2, patient exclusion flags for PL4.8/PL4.9/PL4.10) - a normal admin-grantable
    // module, force-assignable to whichever HR/Quality/Compliance role maintains this data.
    {
        id: 30,
        name: "Compliance Data",
        navLink: "/compliance-data",
        icon: ShieldCheck,
        group: "Configuration",
        regionFeature: "qualityKpiReports"
    },

    // Every user action, login to logout - see Yoton-API/Middlewares/AuditLogMiddleware.cs.
    // A normal admin-grantable module like the others above.
    {
        id: 31,
        name: "Audit Log",
        navLink: "/audit-log",
        icon: ScrollText,
        group: "Configuration"
    },

    // Every staff member's check-in/out for a chosen day. Hardcoded admin-only (like
    // /role-management) rather than an allow-list module - see lib/routeAccess.ts,
    // components/sidebar.tsx and Yoton-API's StaffAttendanceController.
    {
        id: 33,
        name: "Staff Attendance",
        navLink: "/staff-attendance",
        icon: UserCheck,
        group: "Configuration"
    },

    // Admin-authored medical form templates (see Yoton-API/Helpers/ModuleKeys.cs's
    // FormBuilder, AdminOnly like Departments/ConfigLists/Reports - master reference data
    // that shapes what other roles see). Building/mapping templates lives here; filling one
    // out happens in Doctor/Nurse Workbench's own "Medical Forms" section, ungated by this
    // module.
    {
        id: 32,
        name: "Medical Forms",
        navLink: "/medical-forms",
        icon: ClipboardList,
        group: "Configuration"
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
