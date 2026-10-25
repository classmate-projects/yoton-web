"use client";

import { Wrench } from "lucide-react";
import { AssetsNav, AssetsProvider } from "@/components/assets/assetsUi";

// Assets & maintenance: the equipment register and the work orders that keep it running.
export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AssetsProvider>
      <div className="mainPage flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Wrench className="text-primary" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Assets &amp; Maintenance</h1>
              <p className="text-sm text-muted-foreground">Equipment, furniture and IT devices - where they are, what they&apos;re worth, servicing, calibration and repairs.</p>
            </div>
          </div>
          <AssetsNav />
        </div>
        {children}
      </div>
    </AssetsProvider>
  );
}
