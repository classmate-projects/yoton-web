"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";
import logo from "@/public/yoton_logo.png";
import Sidebar from "@/components/sidebar";
import BackButton from "@/components/BackButton";
import AccessDenied from "@/components/AccessDenied";
import LoadingSpinner from "@/components/LoadingSpinner";
import SessionTimeoutModal from "@/components/SessionTimeoutModal";
import CheckInPromptModal from "@/components/CheckInPromptModal";
import CheckInHeaderWidget from "@/components/CheckInHeaderWidget";
import AutoSaveIndicator from "@/components/AutoSaveIndicator";
import DailyStatsBar from "@/components/DailyStatsBar";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useProactiveTokenRefresh } from "@/hooks/useProactiveTokenRefresh";
import { useSessionRevokedListener } from "@/hooks/useSessionRevokedListener";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { matchRoute, isRouteAllowed, getHomeRoute } from "@/lib/routeAccess";

export default function PageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const { warningSecondsLeft, stayLoggedIn } = useIdleLogout();
  useProactiveTokenRefresh();
  useSessionRevokedListener();

  // Mobile-only drawer state. On desktop the sidebar is always in flow (hover
  // rail), so this is inert there; on mobile the hamburger in the top bar opens
  // the off-canvas Sidebar and the Sidebar closes itself on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);

  // null = still checking, so we never flash a page the role can't see (or
  // bounce off the redirect target) before the check lands.
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "redirecting">(
    "checking",
  );
  // This role's actual landing page - "/" when the dashboard is allowed, otherwise
  // whatever firstAllowedRoute resolves to below. Passed to BackButton so it can tell
  // when the current page *is* that landing page, even when that isn't "/".
  const [homeRoute, setHomeRoute] = useState("/");

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

      setHomeRoute(getHomeRoute(role, allowedModules));

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
        const target = getHomeRoute(role, allowedModules);
        if (target !== "/") {
          setStatus("redirecting");
          router.replace(target);
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

  // Show check-in prompt once per calendar day for every user.
  useEffect(() => {
    if (status !== "allowed") return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("yoton_checkin_prompt_date") !== today) {
      setShowCheckInPrompt(true);
    }
  }, [status]);

  const handleCheckInPromptClose = () => {
    localStorage.setItem("yoton_checkin_prompt_date", new Date().toISOString().slice(0, 10));
    setShowCheckInPrompt(false);
  };

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
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Image src={logo} alt="Yoton" priority className="lg:hidden h-8 w-auto" />
            <BackButton homePath={homeRoute} />
            <DailyStatsBar variant="inline" />
            <div className="flex-1" />
            <AutoSaveIndicator />
            <CheckInHeaderWidget />
          </header>
        <div className="flex-1 min-w-0">
          {status === "denied" ? <AccessDenied /> : children}
        </div>
      </div>
      {showCheckInPrompt && (
        <CheckInPromptModal
          onClose={handleCheckInPromptClose}
          mandatory={getUserDetail()?.staffCheckInRequired ?? false}
        />
      )}
      {warningSecondsLeft !== null && (
        <SessionTimeoutModal secondsLeft={warningSecondsLeft} onStayLoggedIn={stayLoggedIn} />
      )}
    </div>
  );
}
