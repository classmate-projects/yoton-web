"use client";

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems, SidebarGroup, SidebarMenuItem } from "@/helpers/sidebaritems";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { Fragment, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, UserRound, ChevronRight } from "lucide-react";
import { CurrentUserDetail } from "@/types/user.type";
import { getInitials } from "@/lib/getInitials";
import { useUnreadAppointmentRequests } from "@/hooks/useUnreadAppointmentRequests";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { useRolePermissionsSync } from "@/hooks/useRolePermissionsSync";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { stopChatConnection } from "@/lib/chatSignalR";
import { RecentModulesService } from "@/services/recentModules.service";

const SIDEBAR_GROUPS: SidebarGroup[] = ["User Modules", "Configuration"];

interface SidebarProps {
  // Mobile drawer state, owned by the dashboard layout (which also renders the
  // hamburger in the mobile top bar). On desktop these are inert — the rail is
  // always in flow and expands via its own hamburger toggle instead.
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavigableEntry {
  navLink: string;
  name: string;
  icon: React.ComponentType;
  roles: string[];
}

// Every directly-visitable route the sidebar knows about, top-level items and
// their sub-items alike — used to resolve "recently visited" entries back to
// an icon/name/link regardless of which level they live at. Sub-items inherit
// their parent's roles since SidebarSubItem doesn't carry its own.
const NAVIGABLE_ENTRIES: NavigableEntry[] = sidebarMenuItems.flatMap((item) => [
  { navLink: item.navLink, name: item.name, icon: item.icon, roles: item.roles },
  ...(item.subItems?.map((sub) => ({ navLink: sub.navLink, name: sub.name, icon: sub.icon, roles: item.roles })) ?? []),
]);

const MAX_RECENTS = 6;

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserDetail | null>(null);
  // Desktop: click-driven, collapsed to icons-only by default, expands only when
  // the hamburger toggle in the header is clicked. No pinned/persisted state, so
  // server and client both start collapsed — no hydration risk. On mobile there
  // is no separate toggle, so the drawer being open (mobileOpen) is what drives
  // the expanded layout instead — see the derived `isExpanded` below.
  const [clickExpanded, setClickExpanded] = useState(false);
  const isExpanded = clickExpanded || mobileOpen;
  // Admin-only drill-down: which item's sub-items (if any) are currently
  // expanded inline, in place, among its siblings. Reset whenever the sidebar
  // collapses, so it always starts back at the top-level module list next time.
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  const toggleSidebarExpanded = () => {
    setClickExpanded((prev) => {
      const next = !prev;
      if (!next) setExpandedItemId(null);
      return next;
    });
  };

  // Recently-visited modules, most recent first, capped at MAX_RECENTS — shown
  // as an always-visible quick-access rail (see recentItems below) regardless of
  // whether the full nav is expanded or collapsed. Persisted server-side (per
  // signed-in user, see RecentModulesController) rather than localStorage, so
  // the same list follows the user to any browser/device they log into rather
  // than being pinned to whichever one they last used.
  const [recentLinks, setRecentLinks] = useState<string[]>([]);

  useEffect(() => {
    RecentModulesService.get()
      .then((res) => setRecentLinks(res.data || []))
      .catch(() => {
        // Fetch failed - recents just start empty for this load rather than blocking the page.
      });
  }, []);

  useEffect(() => {
    if (!NAVIGABLE_ENTRIES.some((entry) => entry.navLink === pathname)) return;
    // Optimistic: reorder locally immediately so the rail updates without
    // waiting on a round trip, then persist in the background. The server
    // independently caps/prunes to MAX_RECENTS per user, so a failed or
    // slow request here just means this visit doesn't survive a reload —
    // it never blocks navigation.
    setRecentLinks((prev) => [pathname, ...prev.filter((link) => link !== pathname)].slice(0, MAX_RECENTS));
    RecentModulesService.record(pathname).catch(() => {});
  }, [pathname]);

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
    await stopChatConnection();
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
  const { unreadCount: unreadChatCount, clearUnread: clearUnreadChat } = useUnreadChatCount(!!userRole);
  useRolePermissionsSync(userRole);

  // Admin (and only admin) gets the grouped, drill-into-categories layout; every
  // other role gets a flat list of just their own modules plus Settings, no
  // grouping or hierarchy at all.
  const isAdmin = userRole === "admin";

  // Admin-configured per-role restrictions on top of the baseline roles[] below
  // (see /role-management "Permissions") - Settings is exempt so no role can ever
  // be left with nothing reachable.
  const hiddenModules = currentUser?.hiddenModules ?? [];
  const isVisible = (item: SidebarMenuItem) =>
    item.roles.includes(userRole) && (item.navLink === "/settings" || !hiddenModules.includes(item.navLink));
  const isEntryVisible = (entry: NavigableEntry) =>
    entry.roles.includes(userRole) && (entry.navLink === "/settings" || !hiddenModules.includes(entry.navLink));

  const visibleGroups = SIDEBAR_GROUPS.map((group) => ({
    group,
    items: sidebarMenuItems.filter((item) => item.group === group && isVisible(item)),
  })).filter((g) => g.items.length > 0);

  const flatVisibleItems = sidebarMenuItems.filter(isVisible);

  const recentItems = recentLinks
    .map((link) => NAVIGABLE_ENTRIES.find((entry) => entry.navLink === link))
    .filter((entry): entry is NavigableEntry => !!entry && isEntryVisible(entry));

  // Tiles are a fixed 60px in both states — the module grid is only ever shown
  // expanded (see the fade wrapper around <nav> below), so there's no visible
  // size to animate. Rendering it at one fixed size and only ever fading it
  // in/out (after the rail has already finished resizing) is what keeps the
  // reveal jump-free: a flex-wrap's column count (1 tile/row -> 4 tiles/row)
  // can't be interpolated by the browser at all — it snaps the instant the row
  // has room for another tile — so the reflow has to happen while invisible.
  const tileClass = (active: boolean) =>
    `relative flex h-[60px] w-[60px] items-center justify-center rounded-xl transition-all duration-300 ease-in-out group ${active
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  // 4 tiles at 60px plus 3 gaps fits the expanded rail's content width exactly.
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
        className={`sidebar-shell bg-card p-3 border-r border-border z-50 transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col
          fixed inset-y-0 left-0 w-72 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0 ${isExpanded ? "lg:w-72" : "lg:w-28"}`}
      >
        {/* Desktop-only toggle, pinned to the rail's edge - mobile already has
            its own hamburger in the dashboard layout's top bar that drives
            mobileOpen, so this would be redundant (and couldn't collapse the
            drawer anyway) there. The shell above is already a positioned
            element (fixed/sticky), so this anchors to it without needing its
            own "relative" wrapper. */}
        <button
          type="button"
          onClick={toggleSidebarExpanded}
          title={isExpanded ? "Collapse menu" : "Expand menu"}
          aria-label={isExpanded ? "Collapse menu" : "Expand menu"}
          aria-expanded={isExpanded}
          className="absolute -right-3 top-8 z-10 hidden h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-colors duration-200 hover:bg-primary/90 lg:flex"
        >
          <ChevronRight size={14} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </button>

        <div className={`flex items-center transition-all duration-300 ease-in-out ${isExpanded ? "mb-8 px-2" : "mb-4 flex-col gap-2 justify-center"}`}>
          <div className="relative h-10 w-10 shrink-0">
            {/* Collapsed: company logo (falls back to the bundled Yoton logo).
                Expanded: the signed-in user's own photo, or their initials when
                no photo has been uploaded. Collapsing reverts to the company
                logo either way. */}
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

        {/* Recently-visited modules (max 6) - collapsed-only quick access, so
            it's usable without a hamburger click first. Gone once expanded,
            where the full nav (with these same items in it) speaks for itself. */}
        {!isExpanded && recentItems.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground/80 font-semibold mb-1">Recent</p>
              {recentItems.map((entry) => {
                const isActive = pathname === entry.navLink;
                return (
                  <Link
                    key={entry.navLink}
                    href={entry.navLink}
                    title={entry.name}
                    aria-label={entry.name}
                    onClick={() => entry.navLink === "/messages" && clearUnreadChat()}
                    className={tileClass(isActive)}
                  >
                    <span className={tileIconClass(isActive)}>
                      <entry.icon />
                    </span>
                    {entry.navLink === "/messages" && unreadChatCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-card">
                        {unreadChatCount > 9 ? "9+" : unreadChatCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed (idle): nothing here but the logo/hamburger/theme/logout/recent
            chrome above and below — no module icons at all, so there's nothing to
            reflow. Expanded (via the hamburger toggle): the full icon grid, rows
            wrapping naturally with however many items a role/category has. It's
            always mounted at its expanded size; only opacity toggles. Fading in is
            delayed until the rail's width transition has essentially finished,
            so the flex-wrap's column count settles while invisible instead of
            visibly jumping; fading out on leave has no delay, so it's already
            transparent before the rail starts narrowing back down. `inert` keeps
            it out of the tab order and unclickable while hidden, matching what's
            visually true. */}
        <div
          inert={!isExpanded}
          className={`flex-1 overflow-y-auto no-scrollbar scroll-smooth transition-opacity ${isExpanded ? "duration-200 delay-150 opacity-100" : "duration-100 opacity-0"
            }`}
        >
          <nav className="flex flex-col gap-4">
            {isAdmin ? (
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
                      const isItemExpanded = expandedItemId === item.id;
                      const isActive =
                        pathname === item.navLink || !!item.subItems?.some((s) => s.navLink === pathname);

                      // Sub-modules only make sense to drill into once the sidebar
                      // is actually expanded - collapsed icons stay direct links.
                      if (hasSubItems && isExpanded) {
                        return (
                          <Fragment key={item.id}>
                            <button
                              type="button"
                              onClick={() => setExpandedItemId(isItemExpanded ? null : item.id)}
                              title={item.name}
                              aria-label={item.name}
                              aria-expanded={isItemExpanded}
                              className={tileClass(isActive || isItemExpanded)}
                            >
                              <span className={tileIconClass(isActive || isItemExpanded)}>
                                <item.icon />
                              </span>
                              <ChevronRight
                                size={11}
                                className={`absolute top-1 right-1 transition-transform duration-200 ${isItemExpanded ? "rotate-90" : ""} ${isActive || isItemExpanded ? "opacity-70" : "opacity-40"
                                  }`}
                              />
                            </button>
                            {/* Inline expansion, in place, right where the parent tile
                                sits — a basis-full child in the same flex-wrap row
                                forces a line break, so this reads as a panel attached
                                to the tile above rather than a whole new screen. */}
                            {isItemExpanded && (
                              <div className="flex w-full flex-wrap gap-2 rounded-xl bg-muted/50 p-2">
                                {item.subItems?.map((sub) => {
                                  const subActive = pathname === sub.navLink;
                                  return (
                                    <Link
                                      key={sub.id}
                                      href={sub.navLink}
                                      title={sub.name}
                                      aria-label={sub.name}
                                      className={tileClass(subActive)}
                                    >
                                      <span className={tileIconClass(subActive)}>
                                        <sub.icon />
                                      </span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </Fragment>
                        );
                      }

                      return (
                        <Link
                          key={item.id}
                          href={item.navLink}
                          title={item.name}
                          aria-label={item.name}
                          onClick={() => item.navLink === "/messages" && clearUnreadChat()}
                          className={tileClass(isActive)}
                        >
                          <span className={tileIconClass(isActive)}>
                            <item.icon />
                          </span>
                          {item.navLink === "/messages" && unreadChatCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-card">
                              {unreadChatCount > 9 ? "9+" : unreadChatCount}
                            </span>
                          )}
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
                      onClick={() => item.navLink === "/messages" && clearUnreadChat()}
                      className={tileClass(isActive)}
                    >
                      <span className={tileIconClass(isActive)}>
                        <item.icon />
                      </span>
                      {item.navLink === "/messages" && unreadChatCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-card">
                          {unreadChatCount > 9 ? "9+" : unreadChatCount}
                        </span>
                      )}
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
