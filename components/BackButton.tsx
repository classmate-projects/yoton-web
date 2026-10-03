"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Universal back-navigation for the PWA shell.
// When history exists, navigates back; otherwise falls back to the dashboard root
// so the user is never stranded on a page with no exit.
export default function BackButton() {
  const router = useRouter();

  const handleBack = () => {
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
      aria-label="Go back"
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
