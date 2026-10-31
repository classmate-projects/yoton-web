"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Universal back-navigation for the PWA shell.
// When history exists, navigates back; otherwise falls back to the dashboard root
// so the user is never stranded on a page with no exit.
export default function BackButton({ homePath = "/" }: { homePath?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `homePath` is this role's actual landing page - "/" for most roles, but
  // whatever firstAllowedRoute resolved to for a role without dashboard access
  // (see app/(pages)/layout.tsx). That page is the top of the app's navigation
  // tree - there is no page "above" it to go back to (and login/register-company,
  // the only pages that could still be behind it in browser history, must never be
  // reachable once signed in). Disable rather than risk landing on either.
  // usePathname() never includes query params, so also check searchParams: if any
  // are present (e.g. ?patientId=xxx in the doctor workbench), the user is in a
  // sub-view of the home page, not the root itself, and back should be enabled.
  const isRoot = pathname === homePath && !searchParams.toString();

  const handleBack = () => {
    if (isRoot) return;
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      disabled={isRoot}
      aria-label="Go back"
      aria-disabled={isRoot}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
