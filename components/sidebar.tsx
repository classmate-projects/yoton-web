"use client";

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems, SidebarGroup, SidebarMenuItem } from "@/helpers/sidebaritems";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, LogOut, UserRound, ChevronRight, Search, MessageCircle } from "lucide-react";
import { CurrentUserDetail } from "@/types/user.type";
import { getInitials } from "@/lib/getInitials";
import { useAlertCenter } from "@/hooks/useAlertCenter";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { useRolePermissionsSync } from "@/hooks/useRolePermissionsSync";
import { useRoleSignalR } from "@/hooks/useRoleSignalR";
import { getSignalRConnection } from "@/lib/signalR";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { getAvatarColor } from "@/lib/avatarColor";
import { logout } from "@/lib/auth";
import { RecentModulesService } from "@/services/recentModules.service";
import { RoleService } from "@/services/role.service";
import { FetchedRoles } from "@/types/role.type";
import { getRoleIcon } from "@/helpers/roleIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

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
  // Which allowedModules entry governs this entry - undefined means "use navLink itself".
  // Sub-items share their parent's module key since SidebarSubItem doesn't carry its own
  // (matches app/(pages)/layout.tsx's extraProtectedRoutes.moduleKey usage, e.g. the
  // "Doctors Availability" subItem under "Departments & Staff").
  moduleKey?: string;
}

// Every directly-visitable route the sidebar knows about, top-level items and
// their sub-items alike — used to resolve "recently visited" entries back to
// an icon/name/link regardless of which level they live at.
const NAVIGABLE_ENTRIES: NavigableEntry[] = sidebarMenuItems.flatMap((item) => [
  { navLink: item.navLink, name: item.name, icon: item.icon },
  ...(item.subItems?.map((sub) => ({ navLink: sub.navLink, name: sub.name, icon: sub.icon, moduleKey: item.navLink })) ?? []),
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
  // The trigger tile lives inside the nav's own overflow-y-auto scroll container, which
  // clips anything poking out past its right edge (setting overflow on one axis makes the
  // other axis clip too) - so the flyout itself is portaled straight to document.body and
  // positioned in viewport coordinates instead of being laid out as a DOM child of the tile.
  const expandedTriggerRef = useRef<HTMLDivElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const expandedItem = sidebarMenuItems.find((item) => item.id === expandedItemId) ?? null;

  // Admin-only: the "User Modules" group shows one tile per staff role instead of the
  // flat module list - each tile's flyout previews what a real user in that role actually
  // sees (their own granted modules - see RoleService.getAllowedModules). Mirrors the
  // module drill-down mechanism above (own state/refs, since the two flyout "content"
  // shapes differ) rather than sharing it.
  const [roles, setRoles] = useState<FetchedRoles[]>([]);
  const [roleSearch, setRoleSearch] = useState("");
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [roleAllowedModulesCache, setRoleAllowedModulesCache] = useState<Record<string, string[]>>({});
  const roleTriggerRef = useRef<HTMLDivElement | null>(null);
  const roleFlyoutRef = useRef<HTMLDivElement | null>(null);
  const [roleFlyoutPos, setRoleFlyoutPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const expandedRole = roles.find((r) => r.roleId === expandedRoleId) ?? null;

  // Bottom breathing room a portaled flyout keeps clear of the viewport edge - both flyouts
  // below clamp their own height to this so a long module list scrolls internally instead of
  // running off the bottom of the screen with no way to reach/select the items past the fold.
  const FLYOUT_BOTTOM_MARGIN = 16;

  useEffect(() => {
    if (expandedRoleId === null) {
      setRoleFlyoutPos(null);
      return;
    }
    const rect = roleTriggerRef.current?.getBoundingClientRect();
    if (rect) {
      setRoleFlyoutPos({
        top: rect.top,
        left: rect.right + 8,
        maxHeight: window.innerHeight - rect.top - FLYOUT_BOTTOM_MARGIN,
      });
    }
  }, [expandedRoleId]);

  useEffect(() => {
    if (expandedRoleId === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (roleTriggerRef.current?.contains(target)) return;
      if (roleFlyoutRef.current?.contains(target)) return;
      setExpandedRoleId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);

    const navScrollEl = roleTriggerRef.current?.closest("[data-sidebar-scroll]");
    const handleScroll = () => setExpandedRoleId(null);
    navScrollEl?.addEventListener("scroll", handleScroll);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      navScrollEl?.removeEventListener("scroll", handleScroll);
    };
  }, [expandedRoleId]);

  const toggleSidebarExpanded = () => {
    setClickExpanded((prev) => {
      const next = !prev;
      if (!next) setExpandedItemId(null);
      return next;
    });
  };

  // Positions the portaled flyout against the trigger's actual on-screen rect once it's
  // mounted (ref assignment happens during commit, before this effect runs).
  useEffect(() => {
    if (expandedItemId === null) {
      setFlyoutPos(null);
      return;
    }
    const rect = expandedTriggerRef.current?.getBoundingClientRect();
    if (rect) {
      setFlyoutPos({
        top: rect.top,
        left: rect.right + 8,
        maxHeight: window.innerHeight - rect.top - FLYOUT_BOTTOM_MARGIN,
      });
    }
  }, [expandedItemId]);

  // Closes the flyout on an outside click (matches NotificationBell's pattern) or on a
  // scroll of the nav's own container, since a stale viewport position would otherwise
  // leave the flyout floating away from its tile.
  useEffect(() => {
    if (expandedItemId === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (expandedTriggerRef.current?.contains(target)) return;
      if (flyoutRef.current?.contains(target)) return;
      setExpandedItemId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);

    const navScrollEl = expandedTriggerRef.current?.closest("[data-sidebar-scroll]");
    const handleScroll = () => setExpandedItemId(null);
    navScrollEl?.addEventListener("scroll", handleScroll);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      navScrollEl?.removeEventListener("scroll", handleScroll);
    };
  }, [expandedItemId]);

  // Recently-visited modules, most recent first, capped at MAX_RECENTS — shown
  // as an always-visible quick-access rail (see recentItems below) regardless of
  // whether the full nav is expanded or collapsed. Persisted server-side (per
  // signed-in user, see RecentModulesController) rather than localStorage, so
  // the same list follows the user to any browser/device they log into rather
  // than being pinned to whichever one they last used.
  const [recentLinks, setRecentLinks] = useState<string[]>([]);

  useEffect(() => {
    RecentModulesService.get()
      .then((res) => setRecentLinks(Array.from(new Set(res.data || []))))
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
    await logout();
    router.push("/login");
  };

  const themes = [
    { name: "light", icon: Sun, label: "Light" },
    { name: "dark", icon: Moon, label: "Dark" },
    { name: "system", icon: Monitor, label: "System" },
  ];

  const userRole = currentUser?.role || "";
  const { canSeeAlerts, alerts, unreadCount, isRinging, clearUnread } =
    useAlertCenter(userRole, currentUser?.userId);
  const { unreadCount: unreadChatCount, clearUnread: clearUnreadChat } = useUnreadChatCount(!!userRole);
  useRolePermissionsSync(userRole);

  // Admin (and only admin) gets the grouped, drill-into-categories layout; every
  // other role gets a flat list of just their own modules plus Settings, no
  // grouping or hierarchy at all.
  const isAdmin = userRole === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    RoleService.getAll()
      .then((res) => setRoles(res.data ?? []))
      .catch(() => {});
  }, [isAdmin]);

  // A role created/edited/deleted elsewhere (e.g. Role Management, in another tab) shows
  // up in this admin's role tiles immediately instead of needing a refresh.
  useRoleSignalR(setRoles);

  // A role's allowed-modules list edited elsewhere (Role Management's "Manage modules"
  // dialog) should update this admin's already-open role-preview flyout immediately too -
  // without this, roleAllowedModulesCache only ever populates once per roleId (see
  // toggleRoleFlyout below) and would otherwise stay stale until a full page reload.
  // useRolePermissionsSync above handles the matching case for a signed-in end user's own
  // sidebar; this is the admin-side equivalent, keyed by roleId in the local cache instead
  // of the current user's own allowedModules.
  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;

    const handleUpdated = (payload: { roleName: string; allowedModules: string[] }) => {
      setRoles((prevRoles) => {
        const role = prevRoles.find((r) => r.name === payload.roleName);
        if (role) {
          setRoleAllowedModulesCache((prev) => ({ ...prev, [role.roleId]: payload.allowedModules }));
        }
        return prevRoles;
      });
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;

      connection.off("rolePermissionsUpdated", handleUpdated);
      connection.on("rolePermissionsUpdated", handleUpdated);
    };

    connect();

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("rolePermissionsUpdated", handleUpdated);
      });
    };
  }, [isAdmin]);

  const toggleRoleFlyout = (roleId: string) => {
    setExpandedRoleId((prev) => (prev === roleId ? null : roleId));
    if (!(roleId in roleAllowedModulesCache)) {
      RoleService.getAllowedModules(roleId)
        .then((res) => setRoleAllowedModulesCache((prev) => ({ ...prev, [roleId]: res.data ?? [] })))
        .catch(() => setRoleAllowedModulesCache((prev) => ({ ...prev, [roleId]: [] })));
    }
  };

  // What a real user in the expanded role would actually see in their own User Modules
  // section - same allow-list the module list itself uses, just evaluated for that role
  // instead of the signed-in admin. Confidential Notes is excluded even for a "nurse"
  // preview since it isn't part of the allow-list at all (see its own hardcoded rule).
  const expandedRoleModules = expandedRole
    ? sidebarMenuItems.filter(
        (item) =>
          item.group === "User Modules" &&
          item.navLink !== "/nursing/confidential-notes" &&
          (roleAllowedModulesCache[expandedRole.roleId] ?? []).includes(item.navLink)
      )
    : [];

  // Admin-granted per-role module access (see /role-management "Permissions") - Settings
  // is exempt so no role can ever be left with nothing reachable, and Confidential Notes
  // stays nurse-only regardless of any role's allow-list (see its own hardcoded rule).
  const allowedModules = currentUser?.allowedModules ?? [];
  const isModuleAllowed = (navLink: string) => {
    if (navLink === "/settings") return true;
    if (navLink === "/nursing/confidential-notes") return userRole === "nurse";
    return isAdmin || allowedModules.includes(navLink);
  };
  const isVisible = (item: SidebarMenuItem) => isModuleAllowed(item.navLink);
  const isEntryVisible = (entry: NavigableEntry) => isModuleAllowed(entry.moduleKey ?? entry.navLink);

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
    `relative flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-xl transition-all duration-300 ease-in-out group ${active
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  // 4 tiles at 60px plus 3 gaps fits the expanded rail's content width exactly.
  const tileContainerClass = "flex flex-wrap content-start justify-center gap-2";

  const tileIconClass = (active: boolean) =>
    `shrink-0 transition-transform duration-200 text-xl ${active ? "scale-110" : "group-hover:scale-110"}`;

  // Admin-only: grouped sections (User Modules, Configuration) render as a vertical
  // list of full-width rows - icon + capitalized name - instead of the icon-only
  // tile grid above. Other roles keep the flat tile grid untouched.
  const listContainerClass = "flex flex-col gap-1";

  const rowClass = (active: boolean) =>
    `flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${active
      ? "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  // Native title-attribute tooltips aren't styled by CSS (the "capitalize" class on the
  // visible row text has no effect on them), so role names - stored lowercase - need this
  // applied to the actual string for the hover tooltip to read capitalized too.
  const toTitleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

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

        {/* Everything that can legitimately grow past one screen (logo header, the
            collapsed-only Recent rail, the module nav) lives in this one scrollable
            region, so on a short viewport it scrolls internally instead of pushing the
            shell taller than lg:h-screen (which has no overflow-hidden of its own and
            would otherwise leak into the page - see the nav div's own comment below).
            The footer (theme/version/logout) deliberately sits outside it as its own
            shrink-0 sibling so it's always reachable without scrolling, regardless of
            how much is above it. */}
        <div data-sidebar-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar scroll-smooth">
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
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: getAvatarColor(currentUser?.userId || currentUser?.name) }}
                >
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

            {!isExpanded && mounted && canSeeAlerts && unreadCount > 0 && (
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
          {mounted && isExpanded && canSeeAlerts && (
            <div className="ml-auto">
              <NotificationBell
                alerts={alerts}
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
            visually true. No scroll/flex sizing of its own - it's plain in-flow
            content of the scrollable region opened above, which is what actually
            grows/scrolls now. */}
        <div
          inert={!isExpanded}
          className={`transition-opacity ${isExpanded ? "duration-200 delay-150 opacity-100" : "duration-100 opacity-0"
            }`}
        >
          <nav className="flex flex-col gap-4">
            {isAdmin ? (
              <>
                {/* Admin-only Chat shortcut, shown above the "User Modules" section below.
                    Admin implicitly passes isModuleAllowed for every navLink (including
                    "/messages"), but "User Modules" below is repurposed for admin into
                    per-role preview tiles rather than admin's own module links (see that
                    section's own comment) - so without this, admin has no sidebar entry
                    point into chat at all despite always having access to it. */}
                <div className={listContainerClass}>
                  <Link
                    href="/messages"
                    title="Chat"
                    aria-label="Chat"
                    onClick={clearUnreadChat}
                    className={rowClass(pathname === "/messages")}
                  >
                    <span className="shrink-0 text-lg">
                      <MessageCircle />
                    </span>
                    <span className="truncate">Chat</span>
                    {unreadChatCount > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                        {unreadChatCount > 9 ? "9+" : unreadChatCount}
                      </span>
                    )}
                  </Link>
                </div>
                {visibleGroups.map(({ group, items }) => (
                <div key={group}>
                  <span
                    className={`sidebar-label block overflow-hidden whitespace-nowrap px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-all duration-300 ease-in-out ${isExpanded ? "max-h-4 mb-1.5 opacity-100" : "max-h-0 mb-0 opacity-0"
                      }`}
                  >
                    {group}
                  </span>
                  {group === "User Modules" && isExpanded && (
                    <div className="relative mb-2 px-1">
                      <Search
                        size={13}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                      />
                      <input
                        type="text"
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                        placeholder="Search roles..."
                        className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  )}
                  <div className={listContainerClass}>
                    {group === "User Modules"
                      ? // Admin sees one row per staff role instead of the flat module
                        // list - a preview into what each role's own sidebar looks like,
                        // not admin's own module shortcuts (admin already has every
                        // module reachable via the roles this drills into).
                        roles
                          .filter((r) => r.isActive && r.name.toLowerCase() !== "admin")
                          .filter((r) => r.name.toLowerCase().includes(roleSearch.trim().toLowerCase()))
                          .map((role) => {
                            const isRoleExpanded = expandedRoleId === role.roleId;
                            return (
                              <div
                                key={role.roleId}
                                ref={isRoleExpanded ? roleTriggerRef : undefined}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleRoleFlyout(role.roleId)}
                                  title={toTitleCase(role.name)}
                                  aria-label={toTitleCase(role.name)}
                                  aria-expanded={isRoleExpanded}
                                  className={`${rowClass(false)} ${isRoleExpanded ? "ring-2 ring-inset ring-primary/50 text-primary" : ""}`}
                                >
                                  <span className="shrink-0 text-lg">
                                    <FontAwesomeIcon icon={getRoleIcon(role.iconKey)} size="lg" />
                                  </span>
                                  <span className="truncate capitalize">{role.name}</span>
                                  <ChevronRight
                                    size={14}
                                    className={`ml-auto shrink-0 transition-transform duration-200 ${isRoleExpanded ? "rotate-90 opacity-70" : "opacity-40"
                                      }`}
                                  />
                                </button>
                              </div>
                            );
                          })
                      : items.map((item) => {
                      const hasSubItems = !!item.subItems?.length;
                      const isItemExpanded = expandedItemId === item.id;
                      const isActive =
                        pathname === item.navLink || !!item.subItems?.some((s) => s.navLink === pathname);

                      // Sub-modules only make sense to drill into once the sidebar
                      // is actually expanded - collapsed icons stay direct links.
                      // The flyout list itself is portaled (rendered once, below) rather
                      // than nested here, so it isn't clipped by this scroll container.
                      if (hasSubItems && isExpanded) {
                        return (
                          <div
                            key={item.id}
                            ref={isItemExpanded ? expandedTriggerRef : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedItemId(isItemExpanded ? null : item.id)}
                              title={item.name}
                              aria-label={item.name}
                              aria-expanded={isItemExpanded}
                              // Blue fill means "you're on this page right now" (isActive) - an
                              // open-but-not-active flyout gets a lighter ring instead, so the
                              // two states never look like the same thing selected twice.
                              className={`${rowClass(isActive)} ${!isActive && isItemExpanded ? "ring-2 ring-inset ring-primary/50 text-primary" : ""}`}
                            >
                              <span className="shrink-0 text-lg">
                                <item.icon />
                              </span>
                              <span className="truncate capitalize">{item.name}</span>
                              <ChevronRight
                                size={14}
                                className={`ml-auto shrink-0 transition-transform duration-200 ${isItemExpanded ? "rotate-90" : ""} ${isActive || isItemExpanded ? "opacity-70" : "opacity-40"
                                  }`}
                              />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={item.id}
                          href={item.navLink}
                          title={item.name}
                          aria-label={item.name}
                          onClick={() => item.navLink === "/messages" && clearUnreadChat()}
                          className={rowClass(isActive)}
                        >
                          <span className="shrink-0 text-lg">
                            <item.icon />
                          </span>
                          <span className="truncate capitalize">{item.name}</span>
                          {item.navLink === "/messages" && unreadChatCount > 0 && (
                            <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                              {unreadChatCount > 9 ? "9+" : unreadChatCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                ))}
              </>
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
        </div>

        {/* Portaled flyout: rendered once at document.body in viewport ("fixed")
            coordinates, positioned from expandedTriggerRef in the effect above -
            keeps it out of the scrollable region opened above (data-sidebar-scroll),
            which would otherwise clip it. */}
        {mounted && expandedItem && flyoutPos &&
          createPortal(
            <div
              ref={flyoutRef}
              style={{ position: "fixed", top: flyoutPos.top, left: flyoutPos.left, maxHeight: flyoutPos.maxHeight }}
              className="z-[100] w-56 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg shadow-black/10"
            >
              {expandedItem.subItems?.map((sub) => {
                const subActive = pathname === sub.navLink;
                return (
                  <Link
                    key={sub.id}
                    href={sub.navLink}
                    onClick={() => setExpandedItemId(null)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${subActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                  >
                    <span className="shrink-0 text-lg">
                      <sub.icon />
                    </span>
                    <span className="truncate">{sub.name}</span>
                  </Link>
                );
              })}
            </div>,
            document.body
          )}

        {/* Role flyout: same portal-out-of-the-scroll-container reasoning as the module
            flyout above, just listing that role's own User Modules instead of one item's
            subItems. Shown with each module's real name/icon so it reads as "here's what
            this role's sidebar looks like," not admin's own shortcuts. */}
        {mounted && expandedRole && roleFlyoutPos &&
          createPortal(
            <div
              ref={roleFlyoutRef}
              style={{ position: "fixed", top: roleFlyoutPos.top, left: roleFlyoutPos.left, maxHeight: roleFlyoutPos.maxHeight }}
              className="z-[100] w-56 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg shadow-black/10"
            >
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 capitalize">
                {expandedRole.name}
              </p>
              {expandedRoleModules.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No modules visible to this role.</p>
              ) : (
                expandedRoleModules.map((item) => (
                  <Link
                    key={item.id}
                    href={item.navLink}
                    onClick={() => setExpandedRoleId(null)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="shrink-0 text-lg">
                      <item.icon />
                    </span>
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))
              )}
            </div>,
            document.body
          )}

        {/* Outside the scrollable region above on purpose - theme switcher, version
            and logout stay reachable without scrolling no matter how much is above. */}
        <div className="shrink-0 pt-4 flex flex-col gap-4 border-t border-border">
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
