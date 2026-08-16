"use client";

import { useEffect, useState } from "react";
import { isApiLoading, onApiLoadingChange } from "@/lib/apiLoading";

// A slim, non-blocking indeterminate bar across the very top of the viewport — reflects
// every request made through lib/axios.ts's shared `api` instance (which is effectively
// every data call in this app), so individual pages don't each need their own loading
// state just to avoid looking unresponsive while something's in flight. Deliberately not a
// blocking overlay/spinner — mirrors the "floating, doesn't interrupt the workflow"
// preference already established for the ICD upload indicator elsewhere in this app.
export default function ApiLoadingBar() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(isApiLoading());
    return onApiLoadingChange(() => setLoading(isApiLoading()));
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden transition-opacity duration-200"
      style={{ opacity: loading ? 1 : 0 }}
      aria-hidden={!loading}
    >
      <div className="api-loading-sweep h-full w-1/3 bg-primary" />
      <style jsx>{`
        .api-loading-sweep {
          animation: api-loading-sweep 1.1s ease-in-out infinite;
        }
        @keyframes api-loading-sweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </div>
  );
}
