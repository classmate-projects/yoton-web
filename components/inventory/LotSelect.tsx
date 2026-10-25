"use client";

import { useEffect, useState } from "react";
import SearchableSelect, { compactSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import type { StockLot } from "@/types/inventory.type";
import { day, qty } from "./inventoryUi";

interface LotSelectProps {
  storeId: string;
  itemId: string;
  value: string;
  onChange: (batchId: string, lot: StockLot | null) => void;
  // Without "automatic": the user must name a lot (write-offs, returns to the supplier).
  allowAuto?: boolean;
  includeExpired?: boolean;
  unit?: string;
}

// Which lot (batch) to take stock from - "automatic" means first-expiry-first-out.
export default function LotSelect({ storeId, itemId, value, onChange, allowAuto = true, includeExpired = false, unit = "" }: LotSelectProps) {
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storeId || !itemId) return;
    let alive = true;
    InventoryService.lots(storeId, itemId, includeExpired)
      .then((r) => alive && setLots(r.data))
      .catch(() => alive && setLots([]))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [storeId, itemId, includeExpired]);

  // The automatic choice also shows how much the store holds, so nobody has to open the list to check.
  const total = lots.reduce((sum, l) => sum + l.quantity, 0);
  const options = [
    ...(allowAuto ? [{ value: "", label: loaded ? `Automatic · ${qty(total)} ${unit} in stock` : "Automatic (first expiry first)" }] : []),
    ...lots.map((l) => ({
      value: l.batchId,
      label: `${l.batchNumber ?? "No batch"}${l.expiryDate ? ` · exp ${day(l.expiryDate)}${l.isExpired ? " (EXPIRED)" : ""}` : ""} · ${qty(l.quantity)} ${unit}`,
    })),
  ];

  return (
    <SearchableSelect
      value={value}
      onChange={(v) => onChange(v, lots.find((l) => l.batchId === v) ?? null)}
      options={options}
      placeholder={lots.length === 0 ? "No stock" : "Choose batch…"}
      className={compactSelectClass}
      preserveCase
    />
  );
}
