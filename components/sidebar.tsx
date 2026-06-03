"use client";

interface CurrentUserType {
  role: string;
  name: string;
}

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, ChevronRight, ChevronLeft, LogOut } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
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
      className={`bg-card sticky top-0 h-screen p-3 border-r border-border z-50 transition-all duration-300 ease-in-out shrink-0 flex flex-col ${
        isExpanded ? "w-72" : "w-20"
      }`}
    >
      <button
        title={isExpanded ? "Collapse" : "Expand"}
        onClick={() => setIsExpanded((prev) => !prev)}
        className="absolute -right-3 top-10 bg-primary text-primary-foreground rounded-full p-1 shadow-md hover:scale-110 transition-transform cursor-pointer z-50"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className={`flex items-center gap-3 mb-8 ${isExpanded ? "px-2" : "justify-center"}`}>
        <div className="relative shrink-0">
          <Image src={logo} alt="logo" height={40} width={40} className="rounded-lg shadow-sm" loading="eager" />
        </div>
        {isExpanded && (
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-primary truncate">
              Yoton Health
            </h1>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
              {currentUser?.role || "Guest"} • {currentUser?.name || "User"}
            </div>
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
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 group ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      } ${!isExpanded && "justify-center px-0"}`}
                    >
                      <span className={`shrink-0 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
                        <item.icon />
                      </span>
                      {isExpanded && (
                        <span className="whitespace-nowrap text-sm font-medium">
                          {item.name}
                        </span>
                      )}
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
              className={`flex-1 flex items-center justify-center cursor-pointer p-2 rounded-md transition-all ${
                mounted && theme === t.name
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={t.label}
            >
              <t.icon size={16} />
              {isExpanded && <span className="ml-2 text-xs font-medium">{t.label}</span>}
            </button>
          ))}
        </div>

        <div className={`flex flex-col gap-2 ${!isExpanded && "items-center"}`}>
          {isExpanded && (
            <p className="px-2 text-[10px] text-muted-foreground font-mono">v{pkg.version}</p>
          )}
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center gap-3 text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 cursor-pointer hover:bg-red-400/80 ${
              isExpanded ? "px-3 py-2.5 w-full" : "p-3 justify-center"
            }`}
          >
            <LogOut size={18} />
            {isExpanded && <span className="text-sm font-semibold">Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
