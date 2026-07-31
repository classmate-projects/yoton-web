"use client";

interface CurrentUserType {
  role: string;
  name: string;
}

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, ChevronRight, ChevronLeft, LogOut } from "lucide-react";

// useLayoutEffect warns when it runs during SSR; fall back to useEffect there
// since this hook only ever needs to run on the client anyway.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
  // Always start expanded so the first client render matches the
  // server-rendered HTML exactly (no hydration mismatch). The real stored
  // preference is applied synchronously below, before the browser paints.
  const [isExpanded, setIsExpanded] = useState(true);

  useIsomorphicLayoutEffect(() => {
    const stored = localStorage.getItem("yoton_sidebar_expanded");
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
  }, []);

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

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("yoton_sidebar_expanded", String(next));
      document.documentElement.setAttribute(
        "data-sidebar",
        next ? "expanded" : "collapsed"
      );
      return next;
    });
  };

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

  return (
    <div
      className={`sidebar-shell bg-card sticky top-0 h-screen p-3 border-r border-border z-50 transition-all duration-300 ease-in-out shrink-0 flex flex-col ${isExpanded ? "w-72" : "w-20"
        }`}
    >
      <button
        title={isExpanded ? "Collapse" : "Expand"}
        onClick={toggleSidebar}
        className="absolute -right-3 top-10 bg-primary text-primary-foreground rounded-full p-1 shadow-md hover:scale-110 transition-transform cursor-pointer z-50"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

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
        <nav>
          <ul className="flex flex-col gap-1.5">
            {sidebarMenuItems.map((item) => {
              const userRole = currentUser?.role || "";
              if (item.roles.includes(userRole)) {
                const isActive = pathname === item.navLink;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.navLink}
                      title={isExpanded ? "" : item.name}
                      className={`flex items-center py-2.5 px-3 rounded-xl transition-all duration-200 group ${isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        } ${!isExpanded && "justify-center px-0"}`}
                    >
                      <span className={`shrink-0 transition-transform duration-200 text-xl ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                        <item.icon />
                      </span>
                      <span
                        className={`sidebar-label overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 ease-in-out ${isExpanded ? "ml-3 max-w-[160px] opacity-100" : "ml-0 max-w-0 opacity-0"
                          }`}
                      >
                        {item.name}
                      </span>
                    </Link>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </nav>
      </div>

      <div className="mt-auto pt-4 flex flex-col gap-4 border-t border-border">
        <div className={`flex items-center gap-1 bg-muted p-1 rounded-lg ${!isExpanded && "flex-col"}`}>
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`flex-1 flex items-center justify-center cursor-pointer p-2 rounded-md transition-all ${mounted && theme === t.name
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
