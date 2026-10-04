import { sidebarMenuItems } from "@/helpers/sidebaritems";

// Pages that are reachable by URL (e.g. from a button on an admin page) but
// intentionally left out of the sidebar itself - still need the same
// access gate as sidebar items, just not a nav entry of their own.
export interface ProtectedRoute {
  navLink: string;
  // Which sidebarMenuItems.navLink's allowed-modules entry governs this route, for
  // entries that aren't independently grantable in their own right (undefined means
  // "use this route's own navLink" - see isRouteAllowed below).
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
];

// Settings and Confidential Notes are never part of the allow-list (see
// helpers/sidebaritems.ts's comments on each) - Settings is always reachable, and
// Confidential Notes has its own hardcoded nurse-only rule instead.
export const protectedRoutes: ProtectedRoute[] = [
  ...sidebarMenuItems
    .filter((item) => item.navLink !== "/settings")
    .map((item) =>
      item.navLink === "/nursing/confidential-notes"
        ? { navLink: item.navLink, hardcodedRoles: ["nurse"] }
        : { navLink: item.navLink },
    ),
  ...extraProtectedRoutes,
];

export function matchRoute(pathname: string) {
  const matches = protectedRoutes.filter(
    (item) => pathname === item.navLink || pathname.startsWith(`${item.navLink}/`),
  );
  if (matches.length === 0) return undefined;

  // Prefer the most specific (longest navLink) match, not array order - otherwise a
  // more restrictive sub-route (e.g. "/nursing/confidential-notes", nurse-only) could
  // lose to a broader parent route (e.g. "/nursing") declared earlier.
  return matches.reduce((best, item) => (item.navLink.length > best.navLink.length ? item : best));
}

export function isRouteAllowed(route: ProtectedRoute, role: string, allowedModules: string[]) {
  if (route.hardcodedRoles) return route.hardcodedRoles.includes(role);
  // Admin always has every module - mirrors the backend's ModuleAccessChecker bypass,
  // so admin can never be locked out by a missing/misconfigured allow-list row.
  if (role === "admin") return true;
  return allowedModules.includes(route.moduleKey ?? route.navLink);
}

export function firstAllowedRoute(role: string, allowedModules: string[]) {
  return (
    sidebarMenuItems.find(
      (item) =>
        item.navLink !== "/settings" &&
        item.navLink !== "/nursing/confidential-notes" &&
        (role === "admin" || allowedModules.includes(item.navLink)),
    ) ?? sidebarMenuItems.find((item) => item.navLink === "/settings")
  );
}

// The page a signed-in user actually lands on: the dashboard if their role can see it,
// otherwise the first module their role-allow-list grants (falling back to Settings,
// which every role can always reach). This is the true "first page" for the role, even
// when it isn't "/" - used both to pick the "/" redirect target and, by BackButton, to
// know when there is no in-app page "above" the current one to go back to.
export function getHomeRoute(role: string, allowedModules: string[]): string {
  const rootMatch = matchRoute("/");
  if (!rootMatch || isRouteAllowed(rootMatch, role, allowedModules)) return "/";
  return firstAllowedRoute(role, allowedModules)?.navLink ?? "/";
}
