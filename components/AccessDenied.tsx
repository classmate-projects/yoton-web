"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AccessDenied({
  homeHref = "/",
  homeLabel = "Go back",
}: {
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl bg-destructive/10 p-4 text-destructive">
        <ShieldAlert size={40} />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Access denied</h1>
      <p className="max-w-sm text-muted-foreground">
        You don&apos;t have permission to view this page. If you think this is a
        mistake, contact an administrator.
      </p>
      <Link
        href={homeHref}
        className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:translate-y-[-1px] hover:shadow-primary/30"
      >
        {homeLabel}
      </Link>
    </div>
  );
}
