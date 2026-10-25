"use client";

import { Boxes } from "lucide-react";
import InventoryNav from "@/components/inventory/InventoryNav";
import { InventoryProvider } from "@/components/inventory/inventoryUi";

// The Inventory module: one header and tab row over every section (dashboard, stock, items,
// purchasing, movements, approvals, suppliers, stores, reports).
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <div className="mainPage flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Boxes className="text-primary" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
              <p className="text-sm text-muted-foreground">Stock, purchasing and store movements across every store.</p>
            </div>
          </div>
          <InventoryNav />
        </div>
        {children}
      </div>
    </InventoryProvider>
  );
}
