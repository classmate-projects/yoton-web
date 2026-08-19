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

// Pages that are reachable by URL (e.g. from a button on an admin page) but
// intentionally left out of the sidebar itself — still need the same
// role gate as sidebar items, just not a nav entry of their own.
interface ProtectedRoute {
  navLink: string;
  roles: string[];
  // Which sidebarMenuItems.navLink's hidden-modules state governs this route, for
  // entries that aren't independently toggleable in their own right (undefined means
  // "use this route's own navLink" — see isHidden below).
  moduleKey?: string;
}

const extraProtectedRoutes: ProtectedRoute[] = [
  { navLink: "/role-management", roles: ["admin"] },
  { navLink: "/user-registration", roles: ["admin"] },
  // Only reachable via the merged "Departments & Staff" tile's subItems, so it shares
  // its permission rather than having its own.
  { navLink: "/assign-doctor", roles: ["admin"], moduleKey: "/departments" },
];

const protectedRoutes: ProtectedRoute[] = [
  ...sidebarMenuItems.map((item) => ({ navLink: item.navLink, roles: item.roles })),
  ...extraProtectedRoutes,
];

function matchRoute(pathname: string) {
  const matches = protectedRoutes.filter(
    (item) => pathname === item.navLink || pathname.startsWith(`${item.navLink}/`),
  );
  if (matches.length === 0) return undefined;

  // Prefer the most specific (longest navLink) match, not array order — otherwise a
  // more restrictive sub-route (e.g. "/nursing/confidential-notes", nurse-only) could
  // lose to a broader parent route (e.g. "/nursing", nurse+admin) declared earlier.
  return matches.reduce((best, item) => (item.navLink.length > best.navLink.length ? item : best));
}

// Settings is exempt from hiding entirely so no role can ever be left with zero
// reachable pages — see components/sidebar.tsx's matching isVisible() exemption.
function isHidden(route: ProtectedRoute, hiddenModules: string[]) {
  return route.navLink !== "/settings" && hiddenModules.includes(route.moduleKey ?? route.navLink);
}

function firstAllowedRoute(role: string, hiddenModules: string[]) {
  return (
    sidebarMenuItems.find((item) => item.roles.includes(role) && !isHidden(item, hiddenModules)) ??
    sidebarMenuItems.find((item) => item.navLink === "/settings")
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
    setStatus("checking");

    let role = "";
    let hiddenModules: string[] = [];
    try {
      const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
      role = detail.role || "";
      hiddenModules = detail.hiddenModules || [];
    } catch {
      role = "";
    }

    const match = matchRoute(pathname);

    // Unlisted routes (not in the sidebar or the extra list above) aren't
    // role-gated — allow them through rather than guessing.
    if (!match || (match.roles.includes(role) && !isHidden(match, hiddenModules))) {
      setStatus("allowed");
      return;
    }

    // No access to the home dashboard specifically: send the user straight
    // to the first page their role actually has, instead of an Access
    // Denied wall on the very first screen after login.
    if (pathname === "/") {
      const target = firstAllowedRoute(role, hiddenModules);
      if (target) {
        setStatus("redirecting");
        router.replace(target.navLink);
        return;
      }
    }

    setStatus("denied");
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
