"use client";

import { Loader2 } from "lucide-react";

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="relative">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-primary/10" />
      </div>
    </div>
  );
}
