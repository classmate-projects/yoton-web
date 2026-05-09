interface SidebarMenuItem {
    id: number;
    name: string;
    navLink: string;
    roles: string[];
}

export const sidebarMenuItems: SidebarMenuItem[] = [
    {
        id: 1,
        name: "Dashboard",
        navLink: "/",
        roles: ["admin", "doctor", "nurse", "receptionist"],
    },

    {
        id: 2,
        name: "Registration",
        navLink: "/registration",
        roles: ["receptionist"]
    },

    {
        id: 3,
        name: "Appointments",
        navLink: "/appointments",
        roles: ["admin", "doctor", "nurse", "receptionist"],
    },

    {
        id: 4,
        name: "Patient Records",
        navLink: "/patient-records",
        roles: ["admin", "doctor", "nurse"],
    }
]