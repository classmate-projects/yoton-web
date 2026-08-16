"use client";

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems, SidebarGroup, SidebarMenuItem } from "@/helpers/sidebaritems";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, UserRound, ArrowLeft, ChevronRight } from "lucide-react";
import { CurrentUserDetail } from "@/types/user.type";
import { getInitials } from "@/lib/getInitials";
import { useUnreadAppointmentRequests } from "@/hooks/useUnreadAppointmentRequests";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";

const SIDEBAR_GROUPS: SidebarGroup[] = ["User Modules", "Configuration"];

interface SidebarProps {
  // Mobile drawer state, owned by the dashboard layout (which also renders the
  // hamburger in the mobile top bar). On desktop these are inert — the rail is
  // always in flow and expands on hover instead.
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserDetail | null>(null);
  // Desktop: purely hover-driven, collapsed to icons-only by default, expands on
  // mouse-over. No pinned/persisted state, so server and client both start
  // collapsed — no hydration risk. On mobile there is no hover, so the drawer
  // being open (mobileOpen) is what drives the expanded layout instead — see the
  // derived `isExpanded` below.
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const isExpanded = hoverExpanded || mobileOpen;
  // Admin-only drill-down: which User Modules category (if any) is currently
  // expanded to show its sub-items. Reset whenever the sidebar collapses, so
  // it always starts back at the top-level module list on the next hover.
  const [activeCategory, setActiveCategory] = useState<SidebarMenuItem | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setCurrentUser(getUserDetail());
    });

    // The sidebar stays mounted while the user is on the settings page, so a
    // freshly uploaded avatar/logo needs an explicit nudge to show up here.
    return onUserDetailChange(() => setCurrentUser(getUserDetail()));
  }, []);

  // Auto-close the mobile drawer whenever the route changes — i.e. after any nav
  // link is tapped — so the user lands on the page they picked instead of the
  // drawer staying open over it. Category drill-downs don't change the route, so
  // they correctly keep the drawer open.
  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  // Admin (and only admin) gets the grouped, drill-into-categories layout; every
  // other role gets a flat list of just their own modules plus Settings, no
  // grouping or hierarchy at all.
  const isAdmin = userRole === "admin";

  const visibleGroups = SIDEBAR_GROUPS.map((group) => ({
    group,
    items: sidebarMenuItems.filter((item) => item.group === group && item.roles.includes(userRole)),
  })).filter((g) => g.items.length > 0);

  const flatVisibleItems = sidebarMenuItems.filter((item) => item.roles.includes(userRole));

  // Both states use the same flex-wrap container (see tileContainerClass) — only each
  // tile's own size changes, via an ordinary width/height transition. Switching between
  // aspect-square and a fixed size (or between grid and flex containers, as this used to
  // do) can't be animated by the browser at all, so it snapped instantly while the rail's
  // width kept animating around it — that mismatch was the "not smooth" part. A plain
  // pixel-size transition on the tile is what actually animates.
  const tileClass = (active: boolean, expanded: boolean) =>
    `relative flex items-center justify-center rounded-xl transition-all duration-300 ease-in-out group ${expanded ? "h-[60px] w-[60px]" : "h-11 w-11"
    } ${active
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  // Constant across both states on purpose — 4 tiles at 60px plus 3 gaps fits the
  // expanded rail's content width exactly, and the same wrapping row centers a single
  // 44px tile when collapsed. Keeping the container's own classes unchanged means there's
  // nothing here for the browser to snap; the reflow falls naturally out of the tiles'
  // own animated resize.
  const tileContainerClass = "flex flex-wrap content-start justify-center gap-2";

  const tileIconClass = (active: boolean) =>
    `shrink-0 transition-transform duration-200 text-xl ${active ? "scale-110" : "group-hover:scale-110"}`;

  return (
    <>
      {/* Mobile-only backdrop; tapping it closes the drawer. Inert on desktop. */}
      <div
        onClick={onMobileClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        aria-hidden="true"
      />
      <div
        onMouseEnter={() => setHoverExpanded(true)}
        onMouseLeave={() => {
          setHoverExpanded(false);
          setActiveCategory(null);
        }}
        className={`sidebar-shell bg-card p-3 border-r border-border z-50 transition-all duration-300 ease-in-out flex flex-col
          fixed inset-y-0 left-0 w-72 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0 ${isExpanded ? "lg:w-72" : "lg:w-28"}`}
      >
      <div className={`flex items-center transition-all duration-300 ease-in-out ${isExpanded ? "mb-8 px-2" : "mb-4 flex-col gap-2 justify-center"}`}>
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

      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <nav className="flex flex-col gap-4">
          {/* Collapsed: a single-column icon list (a normal sidebar rail).
              Expanded (on hover): icons wrap into a 4-per-row layout, rows
              growing naturally with however many items a role/category has.
              Name is a native tooltip either way (title attribute). */}
          {isAdmin && activeCategory ? (
            <div>
              <span
                className={`sidebar-label block overflow-hidden whitespace-nowrap px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-all duration-300 ease-in-out ${isExpanded ? "max-h-4 mb-1.5 opacity-100" : "max-h-0 mb-0 opacity-0"
                  }`}
              >
                {activeCategory.name}
              </span>
              <div className={tileContainerClass}>
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  title="Back"
                  aria-label="Back to modules"
                  className={tileClass(false, isExpanded)}
                >
                  <span className={tileIconClass(false)}>
                    <ArrowLeft />
                  </span>
                </button>
                {activeCategory.subItems?.map((sub) => {
                  const isActive = pathname === sub.navLink;
                  return (
                    <Link
                      key={sub.id}
                      href={sub.navLink}
                      title={sub.name}
                      aria-label={sub.name}
                      className={tileClass(isActive, isExpanded)}
                    >
                      <span className={tileIconClass(isActive)}>
                        <sub.icon />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : isAdmin ? (
            visibleGroups.map(({ group, items }) => (
              <div key={group}>
                <span
                  className={`sidebar-label block overflow-hidden whitespace-nowrap px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-all duration-300 ease-in-out ${isExpanded ? "max-h-4 mb-1.5 opacity-100" : "max-h-0 mb-0 opacity-0"
                    }`}
                >
                  {group}
                </span>
                <div className={tileContainerClass}>
                  {items.map((item) => {
                    const hasSubItems = !!item.subItems?.length;
                    const isActive =
                      pathname === item.navLink || !!item.subItems?.some((s) => s.navLink === pathname);

                    // Sub-modules only make sense to drill into once the sidebar
                    // is actually expanded - collapsed icons stay direct links.
                    if (hasSubItems && isExpanded) {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveCategory(item)}
                          title={item.name}
                          aria-label={item.name}
                          className={tileClass(isActive, isExpanded)}
                        >
                          <span className={tileIconClass(isActive)}>
                            <item.icon />
                          </span>
                          <ChevronRight
                            size={11}
                            className={`absolute top-1 right-1 ${isActive ? "opacity-70" : "opacity-40"}`}
                          />
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        href={item.navLink}
                        title={item.name}
                        aria-label={item.name}
                        className={tileClass(isActive, isExpanded)}
                      >
                        <span className={tileIconClass(isActive)}>
                          <item.icon />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            // End users (doctor, nurse, radiologist, etc.): direct modules +
            // Settings only, no grouping, no hierarchy.
            <div className={tileContainerClass}>
              {flatVisibleItems.map((item) => {
                const isActive = pathname === item.navLink;
                return (
                  <Link
                    key={item.id}
                    href={item.navLink}
                    title={item.name}
                    aria-label={item.name}
                    className={tileClass(isActive, isExpanded)}
                  >
                    <span className={tileIconClass(isActive)}>
                      <item.icon />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
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
    </>
  );
}
