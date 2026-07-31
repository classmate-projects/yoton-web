"use client";

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems, SidebarGroup } from "@/helpers/sidebaritems";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, UserRound } from "lucide-react";
import { CurrentUserDetail } from "@/types/user.type";
import { getInitials } from "@/lib/getInitials";
import { useUnreadAppointmentRequests } from "@/hooks/useUnreadAppointmentRequests";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";

const SIDEBAR_GROUPS: SidebarGroup[] = ["User Modules", "Configuration"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserDetail | null>(null);
  // Purely hover-driven: collapsed to icons-only by default for every role,
  // expands on mouse-over, collapses again on mouse-out. No pinned/persisted
  // state, so server and client both start collapsed — no hydration risk.
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setCurrentUser(getUserDetail());
    });

    // The sidebar stays mounted while the user is on the settings page, so a
    // freshly uploaded avatar/logo needs an explicit nudge to show up here.
    return onUserDetailChange(() => setCurrentUser(getUserDetail()));
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
  const { canSeeRequests, notifications, unreadCount, isRinging, clearUnread } =
    useUnreadAppointmentRequests(userRole);

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`sidebar-shell bg-card sticky top-0 h-screen p-3 border-r border-border z-50 transition-all duration-300 ease-in-out shrink-0 flex flex-col ${isExpanded ? "w-72" : "w-28"
        }`}
    >
      <div className={`flex items-center mb-8 ${isExpanded ? "px-2" : "flex-col gap-2 justify-center"}`}>
        <div className="relative h-10 w-10 shrink-0">
          {/* Collapsed: company logo (falls back to the bundled Yoton logo).
              Expanded (on hover): the signed-in user's own photo, or their
              initials when no photo has been uploaded. Collapsing reverts to
              the company logo either way. */}
          {isExpanded ? (
            currentUser?.userImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path; not eligible for next/image's static optimization
              <img
                src={backendAssetUrl(currentUser.userImage) ?? undefined}
                alt={currentUser?.name || "User"}
                className="h-10 w-10 rounded-lg object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                {currentUser?.name ? getInitials(currentUser.name) : <UserRound size={18} />}
              </div>
            )
          ) : currentUser?.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path; not eligible for next/image's static optimization
            <img
              src={backendAssetUrl(currentUser.companyLogoUrl) ?? undefined}
              alt={currentUser?.companyName || "Company logo"}
              className="h-10 w-10 rounded-lg object-cover shadow-sm"
            />
          ) : (
            <Image src={logo} alt="logo" height={40} width={40} className="rounded-lg shadow-sm" loading="eager" />
          )}

          {!isExpanded && mounted && canSeeRequests && unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-card">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <div
          className={`sidebar-label overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? "ml-3 max-w-[200px] opacity-100" : "ml-0 max-w-0 opacity-0"
            }`}
        >
          <h1 className="text-lg font-bold text-primary truncate">
            {currentUser?.companyName || "Yoton Health"}
          </h1>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
            {currentUser?.role || "Guest"} • {currentUser?.name || "User"}
          </div>
        </div>
        {mounted && isExpanded && canSeeRequests && (
          <div className="ml-auto">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              isRinging={isRinging}
              onOpen={clearUnread}
            />
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
                <span
                  className={`sidebar-label mb-1.5 block overflow-hidden whitespace-nowrap px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-all duration-300 ease-in-out ${isExpanded ? "max-h-4 opacity-100" : "max-h-0 opacity-0"
                    }`}
                >
                  {group}
                </span>
                {/* Collapsed: a single-column icon list (a normal sidebar rail).
                    Expanded (on hover): icons rearrange into a grid so the wider
                    sidebar doesn't leave a single narrow column of empty space.
                    Name is a native tooltip either way (title attribute). */}
                <div className={isExpanded ? "grid grid-cols-4 gap-2" : "flex flex-col gap-2"}>
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
