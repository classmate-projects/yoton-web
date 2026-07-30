"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import AccessDenied from "@/components/AccessDenied";
import LoadingSpinner from "@/components/LoadingSpinner";
import { sidebarMenuItems } from "@/helpers/sidebaritems";

// Pages that are reachable by URL (e.g. from a button on an admin page) but
// intentionally left out of the sidebar itself — still need the same
// role gate as sidebar items, just not a nav entry of their own.
const extraProtectedRoutes = [
  { navLink: "/role-management", roles: ["admin"] },
  { navLink: "/user-registration", roles: ["admin"] },
];

const protectedRoutes = [...sidebarMenuItems, ...extraProtectedRoutes];

function matchRoute(pathname: string) {
  return protectedRoutes.find(
    (item) => pathname === item.navLink || pathname.startsWith(`${item.navLink}/`),
  );
}

function firstAllowedRoute(role: string) {
  return sidebarMenuItems.find((item) => item.roles.includes(role));
}

export default function PageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  // null = still checking, so we never flash a page the role can't see (or
  // bounce off the redirect target) before the check lands.
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "redirecting">(
    "checking",
  );

  useEffect(() => {
    setStatus("checking");

    let role = "";
    try {
      role = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").role || "";
    } catch {
      role = "";
    }

    const match = matchRoute(pathname);

    // Unlisted routes (not in the sidebar or the extra list above) aren't
    // role-gated — allow them through rather than guessing.
    if (!match || match.roles.includes(role)) {
      setStatus("allowed");
      return;
    }

    // No access to the home dashboard specifically: send the user straight
    // to the first page their role actually has, instead of an Access
    // Denied wall on the very first screen after login.
    if (pathname === "/") {
      const target = firstAllowedRoute(role);
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
      <Sidebar />
      <div className="flex-1 min-w-0">
        {status === "denied" ? <AccessDenied /> : children}
      </div>
    </div>
  );
}
