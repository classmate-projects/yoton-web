"use client";

interface CurrentUserType {
  role: string;
  name: string;
}

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems, SidebarGroup } from "@/helpers/sidebaritems";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";

const SIDEBAR_GROUPS: SidebarGroup[] = ["User Modules", "Configuration"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
  // Purely hover-driven: collapsed to icons-only by default for every role,
  // expands on mouse-over, collapses again on mouse-out. No pinned/persisted
  // state, so server and client both start collapsed — no hydration risk.
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      const user = localStorage.getItem("yoton_user_detail");
      if (user) {
        try {
          setCurrentUser(JSON.parse(user));
        } catch (e) {
          console.error("Failed to parse user detail", e);
        }
      }
    });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    localStorage.removeItem("yoton_token");
    localStorage.removeItem("yoton_user_detail");
    router.push("/login");
  };

  const themes = [
    { name: "light", icon: Sun, label: "Light" },
    { name: "dark", icon: Moon, label: "Dark" },
    { name: "system", icon: Monitor, label: "System" },
  ];

  const userRole = currentUser?.role || "";

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`sidebar-shell bg-card sticky top-0 h-screen p-3 border-r border-border z-50 transition-all duration-300 ease-in-out shrink-0 flex flex-col ${isExpanded ? "w-72" : "w-28"
        }`}
    >
      <div className={`flex items-center mb-8 ${isExpanded ? "px-2" : "flex-col gap-2 justify-center"}`}>
        <div className="relative shrink-0">
          <Image src={logo} alt="logo" height={40} width={40} className="rounded-lg shadow-sm" loading="eager" />
        </div>
        <div
          className={`sidebar-label overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? "ml-3 max-w-[200px] opacity-100" : "ml-0 max-w-0 opacity-0"
            }`}
        >
          <h1 className="text-lg font-bold text-primary truncate">
            Yoton Health
          </h1>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
            {currentUser?.role || "Guest"} • {currentUser?.name || "User"}
          </div>
        </div>
        {mounted && (
          <div className={isExpanded ? "ml-auto" : ""}>
            <NotificationBell role={currentUser?.role || ""} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <nav className="flex flex-col gap-4">
          {SIDEBAR_GROUPS.map((group) => {
            const items = sidebarMenuItems.filter(
              (item) => item.group === group && item.roles.includes(userRole)
            );
            if (items.length === 0) return null;

            return (
              <div key={group}>
                <span className="mb-1.5 block overflow-hidden whitespace-nowrap px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {group}
                </span>
                {/* Icon-only grid — the item name is no longer shown inline, only as a
                    native tooltip on hover (title attribute), so the sidebar can stay
                    narrow while still surfacing every module at a glance. */}
                <div className={`grid gap-2 ${isExpanded ? "grid-cols-4" : "grid-cols-3"}`}>
                  {items.map((item) => {
                    const isActive = pathname === item.navLink;
                    return (
                      <Link
                        key={item.id}
                        href={item.navLink}
                        title={item.name}
                        aria-label={item.name}
                        className={`aspect-square flex items-center justify-center rounded-xl transition-all duration-200 group ${isActive
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                      >
                        <span className={`shrink-0 transition-transform duration-200 text-xl ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                          <item.icon />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto pt-4 flex flex-col gap-4 border-t border-border">
        <div className={`flex items-center gap-1 bg-muted p-1 rounded-lg ${!isExpanded && "flex-col"}`}>
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`flex-1 flex items-center justify-center cursor-pointer p-2 rounded-md transition-all duration-300 ${mounted && theme === t.name
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              title={t.label}
            >
              <t.icon size={16} />
              <span
                className={`sidebar-label overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-300 ease-in-out ${isExpanded ? "ml-2 max-w-[80px] opacity-100" : "ml-0 max-w-0 opacity-0"
                  }`}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>

        <div className={`flex flex-col ${!isExpanded && "items-center"}`}>
          <p
            className={`sidebar-label overflow-hidden whitespace-nowrap px-2 text-[10px] text-muted-foreground font-mono transition-all duration-300 ease-in-out ${isExpanded ? "max-h-6 mb-2 opacity-100" : "max-h-0 mb-0 opacity-0"
              }`}
          >
            v{pkg.version}
          </p>
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 cursor-pointer hover:bg-red-400/80 ${isExpanded ? "px-3 py-2.5 w-full" : "p-3 justify-center"
              }`}
          >
            <LogOut size={18} />
            <span
              className={`sidebar-label overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ease-in-out ${isExpanded ? "ml-3 max-w-[120px] opacity-100" : "ml-0 max-w-0 opacity-0"
                }`}
            >
              Logout
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
