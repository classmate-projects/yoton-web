"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import logo from "@/public/yoton_logo.png";
import LoadingSpinner from "@/components/LoadingSpinner";
import SessionTimeoutModal from "@/components/SessionTimeoutModal";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useProactiveTokenRefresh } from "@/hooks/useProactiveTokenRefresh";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { logout } from "@/lib/auth";

// Pages that sit outside the clinic app: replacing an issued password (/change-password) and
// the super administrator's system setup (/system-setup - choosing the installation's
// country). No sidebar, check-in prompt or clinic widgets - just the page and a way to sign
// out. The super administrator never reaches the clinic pages ((pages)/layout.tsx sends them
// here), and the API keeps that account out of every clinic module too.
export default function SetupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { warningSecondsLeft, stayLoggedIn } = useIdleLogout();
  useProactiveTokenRefresh();

  const [status, setStatus] = useState<"checking" | "allowed">("checking");
  const [name, setName] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const check = () => {
      const detail = getUserDetail();
      if (!detail || !localStorage.getItem("yoton_token")) {
        router.replace("/login");
        return;
      }
      setName(detail.name ?? "");
      setIsSuperAdmin(detail.role === "superadmin");
      if (detail.mustChangePassword && pathname !== "/change-password") {
        router.replace("/change-password");
        return;
      }
      if (pathname === "/system-setup" && detail.role !== "superadmin") {
        router.replace("/");
        return;
      }
      setStatus("allowed");
    };
    check();
    return onUserDetailChange(check);
  }, [pathname, router]);

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Image src={logo} alt="Yoton" priority className="h-8 w-auto" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">Yoton Health</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSuperAdmin ? "System administration" : "Account"}
            </p>
          </div>
          <div className="flex-1" />
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">{name}</span>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            title={`Theme: ${theme}`}
            aria-label="Change theme"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:bg-muted transition-colors"
          >
            {theme === "dark" ? <Moon size={16} /> : theme === "light" ? <Sun size={16} /> : <Monitor size={16} />}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
      {warningSecondsLeft !== null && (
        <SessionTimeoutModal secondsLeft={warningSecondsLeft} onStayLoggedIn={stayLoggedIn} />
      )}
    </div>
  );
}
