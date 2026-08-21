"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";
import logo from "@/public/yoton_logo.png";
import Sidebar from "@/components/sidebar";
import AccessDenied from "@/components/AccessDenied";
import LoadingSpinner from "@/components/LoadingSpinner";
import SessionTimeoutModal from "@/components/SessionTimeoutModal";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { onUserDetailChange } from "@/lib/userDetail";

// Pages that are reachable by URL (e.g. from a button on an admin page) but
// intentionally left out of the sidebar itself — still need the same
// access gate as sidebar items, just not a nav entry of their own.
interface ProtectedRoute {
  navLink: string;
  // Which sidebarMenuItems.navLink's allowed-modules entry governs this route, for
  // entries that aren't independently grantable in their own right (undefined means
  // "use this route's own navLink" — see isRouteAllowed below).
  moduleKey?: string;
  // Set only for the handful of routes that sit outside the per-role allow-list system
  // entirely (mirrors the backend's matching hardcoded [Authorize(Roles=...)] carve-outs):
  // admin-only meta pages that control the permission system itself, and Confidential
  // Notes' nurse-only rule, which excludes even admin.
  hardcodedRoles?: string[];
}

const extraProtectedRoutes: ProtectedRoute[] = [
  { navLink: "/role-management", hardcodedRoles: ["admin"] },
  { navLink: "/user-registration", hardcodedRoles: ["admin"] },
  // Only reachable via the merged "Departments & Staff" tile's subItems, so it shares
  // its permission rather than having its own.
  { navLink: "/assign-doctor", moduleKey: "/departments" },
];

// Settings and Confidential Notes are never part of the allow-list (see
// helpers/sidebaritems.ts's comments on each) - Settings is always reachable, and
// Confidential Notes has its own hardcoded nurse-only rule instead. Check-in is a normal
// admin-grantable module like any other (see Role Management).
const protectedRoutes: ProtectedRoute[] = [
  ...sidebarMenuItems
    .filter((item) => item.navLink !== "/settings")
    .map((item) =>
      item.navLink === "/nursing/confidential-notes"
        ? { navLink: item.navLink, hardcodedRoles: ["nurse"] }
        : { navLink: item.navLink },
    ),
  ...extraProtectedRoutes,
];

function matchRoute(pathname: string) {
  const matches = protectedRoutes.filter(
    (item) => pathname === item.navLink || pathname.startsWith(`${item.navLink}/`),
  );
  if (matches.length === 0) return undefined;

  // Prefer the most specific (longest navLink) match, not array order — otherwise a
  // more restrictive sub-route (e.g. "/nursing/confidential-notes", nurse-only) could
  // lose to a broader parent route (e.g. "/nursing") declared earlier.
  return matches.reduce((best, item) => (item.navLink.length > best.navLink.length ? item : best));
}

function isRouteAllowed(route: ProtectedRoute, role: string, allowedModules: string[]) {
  if (route.hardcodedRoles) return route.hardcodedRoles.includes(role);
  // Admin always has every module - mirrors the backend's ModuleAccessChecker bypass,
  // so admin can never be locked out by a missing/misconfigured allow-list row.
  if (role === "admin") return true;
  return allowedModules.includes(route.moduleKey ?? route.navLink);
}

function firstAllowedRoute(role: string, allowedModules: string[]) {
  return (
    sidebarMenuItems.find(
      (item) =>
        item.navLink !== "/settings" &&
        item.navLink !== "/nursing/confidential-notes" &&
        (role === "admin" || allowedModules.includes(item.navLink)),
    ) ?? sidebarMenuItems.find((item) => item.navLink === "/settings")
  );
}

export default function PageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const { warningSecondsLeft, stayLoggedIn } = useIdleLogout();

  // Mobile-only drawer state. On desktop the sidebar is always in flow (hover
  // rail), so this is inert there; on mobile the hamburger in the top bar opens
  // the off-canvas Sidebar and the Sidebar closes itself on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // null = still checking, so we never flash a page the role can't see (or
  // bounce off the redirect target) before the check lands.
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "redirecting">(
    "checking",
  );

  useEffect(() => {
    const checkAccess = () => {
      setStatus("checking");

      let role = "";
      let allowedModules: string[] = [];
      try {
        const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
        role = detail.role || "";
        allowedModules = detail.allowedModules || [];
      } catch {
        role = "";
      }

      const match = matchRoute(pathname);

      // Unlisted routes (not in the sidebar or the extra list above) aren't
      // gated — allow them through rather than guessing.
      if (!match || isRouteAllowed(match, role, allowedModules)) {
        setStatus("allowed");
        return;
      }

      // No access to the home dashboard specifically: send the user straight
      // to the first page their role actually has, instead of an Access
      // Denied wall on the very first screen after login.
      if (pathname === "/") {
        const target = firstAllowedRoute(role, allowedModules);
        if (target) {
          setStatus("redirecting");
          router.replace(target.navLink);
          return;
        }
      }

      setStatus("denied");
    };

    checkAccess();

    // Re-checks without needing a navigation when an admin live-changes this session's
    // role permissions (see useRolePermissionsSync) - previously only the sidebar's own
    // nav list reacted to this event, so the route guard could keep a page open a few
    // seconds after its access had actually been revoked.
    return onUserDetailChange(checkAccess);
  }, [pathname, router]);

  if (status === "checking" || status === "redirecting") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-row">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile-only top bar: the desktop sidebar is off-canvas on small
            screens, so this gives touch users a way to open it plus a stable
            branded header. Hidden entirely from lg up. */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Image src={logo} alt="Yoton" priority className="h-8 w-auto" />
        </header>
        <div className="flex-1 min-w-0">
          {status === "denied" ? <AccessDenied /> : children}
        </div>
      </div>
      {warningSecondsLeft !== null && (
        <SessionTimeoutModal secondsLeft={warningSecondsLeft} onStayLoggedIn={stayLoggedIn} />
      )}
    </div>
  );
}
