"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inventory", label: "Dashboard" },
  { href: "/inventory/stock", label: "Stock" },
  { href: "/inventory/items", label: "Items" },
  { href: "/inventory/purchase-orders", label: "Purchase orders" },
  { href: "/inventory/receipts", label: "Goods receipts" },
  { href: "/inventory/requisitions", label: "Requisitions" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/issues", label: "Issues" },
  { href: "/inventory/adjustments", label: "Adjustments" },
  { href: "/inventory/counts", label: "Stock counts" },
  { href: "/inventory/usage", label: "Test supplies" },
  { href: "/inventory/suppliers", label: "Suppliers" },
  { href: "/inventory/stores", label: "Stores" },
  { href: "/inventory/reports", label: "Reports" },
];

// The Inventory module's sections - one row of tabs that scrolls sideways on small screens.
export default function InventoryNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {TABS.map((t) => {
        const active = t.href === "/inventory" ? pathname === "/inventory" : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
