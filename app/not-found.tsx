"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-6 py-12 bg-background relative overflow-hidden select-none">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center flex flex-col items-center z-10">

        {/* Big 404 text with gradient */}
        <h1 className="text-9xl font-black tracking-tighter text-foreground relative select-none">
          <span className="bg-linear-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            404
          </span>
        </h1>

        <h2 className="text-2xl font-bold text-foreground mt-4">
          Oops! Page Not Found
        </h2>

        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          The medical record or dashboard page you are trying to access might have been moved, deleted, or does not exist. Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full mt-10">
          <button
            onClick={() => router.back()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 border border-border rounded-2xl bg-card text-foreground font-semibold shadow-sm hover:bg-muted transition-all active:scale-[0.98]"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>

          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98]"
          >
            <Home size={20} />
            Home
          </Link>
        </div>

        {/* Footer info */}
        <p className="text-xs text-muted-foreground mt-12">
          If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}