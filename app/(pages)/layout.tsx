"use client";

import { useEffect, useState, Suspense } from "react";
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
import { useConnectionAlerts } from "@/hooks/useConnectionState";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { matchRoute, isRouteAllowed, getHomeRoute } from "@/lib/routeAccess";
import { CurrentEncounterProvider, useCurrentEncounter } from "@/lib/currentEncounterContext";
import OrderSetPanel from "@/components/orderSet/OrderSetPanel";
import { ClipboardList, Unlock as UnlockIcon } from "lucide-react";

// Reads encounter state from context to show "Reopen" button; must be a separate
// component so it can call useCurrentEncounter() while living inside the provider.
function HeaderActions({ isDoctor, onOpenOrderSets }: { isDoctor: boolean; onOpenOrderSets: () => void }) {
  const { isCompleted, onRequestReopen } = useCurrentEncounter();
  return (
    <>
      <AutoSaveIndicator />
      {isDoctor && isCompleted && onRequestReopen && (
        <button
          type="button"
          onClick={onRequestReopen}
          title="Request to reopen this completed encounter"
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors hover:border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/50"
        >
          <UnlockIcon size={15} />
          <span className="hidden sm:inline">Reopen</span>
        </button>
      )}
      {isDoctor && (
        <button
          type="button"
          onClick={onOpenOrderSets}
          title="Order Sets"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          <ClipboardList size={15} />
          <span className="hidden sm:inline">Order Sets</span>
        </button>
      )}
      <CheckInHeaderWidget />
    </>
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
  useProactiveTokenRefresh();
  useSessionRevokedListener();
  useConnectionAlerts();

  // Mobile-only drawer state. On desktop the sidebar is always in flow (hover
  // rail), so this is inert there; on mobile the hamburger in the top bar opens
  // the off-canvas Sidebar and the Sidebar closes itself on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [showOrderSets, setShowOrderSets] = useState(false);
  const [isDoctor, setIsDoctor] = useState(false);

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
      setIsDoctor(role === "admin" || allowedModules.includes("/doctor"));

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
    <CurrentEncounterProvider>
    <div className="h-screen flex flex-row overflow-hidden">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <header className="shrink-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Image src={logo} alt="Yoton" priority className="lg:hidden h-8 w-auto" />
            <Suspense fallback={<div className="h-10 w-10 shrink-0" />}>
              <BackButton homePath={homeRoute} />
            </Suspense>
            <DailyStatsBar variant="inline" />
            <div className="flex-1" />
            <HeaderActions isDoctor={isDoctor} onOpenOrderSets={() => setShowOrderSets(true)} />
          </header>
        {/* outline-none: Chromium makes scroll containers focusable, and Next.js moves focus
            into the new page after navigation - so after a keyboard login (Enter) the browser
            drew its focus ring around this whole content area until the next click. It's a
            scroll area, not a control, so it doesn't need one. */}
        <div className="flex-1 min-w-0 min-h-0 overflow-auto outline-none">
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
      {showOrderSets && <OrderSetPanel onClose={() => setShowOrderSets(false)} />}
    </div>
    </CurrentEncounterProvider>
  );
}
