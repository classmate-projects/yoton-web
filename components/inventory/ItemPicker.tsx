"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import { InventoryService } from "@/services/inventory.service";
import { apiErrorMessage } from "@/lib/apiError";
import type { CatalogMedicine, InventoryItem } from "@/types/inventory.type";
import { qty } from "./inventoryUi";

interface ItemPickerProps {
  // Called with the item, and the lot when a batch label was scanned.
  onPick: (item: InventoryItem, scannedBatchId?: string | null) => void;
  placeholder?: string;
  itemType?: string;
  autoFocus?: boolean;
  // Also offer Pharmacy catalog medicines nobody has stocked yet (the store team only) -
  // picking one makes it an inventory item first.
  includeMedicines?: boolean;
}

type Entry = { kind: "item"; item: InventoryItem } | { kind: "medicine"; medicine: CatalogMedicine };

// Finds an item by name or code as you type - or by scanning: a barcode scanner types the code
// and presses Enter, which looks up an item code, a manufacturer barcode or a batch label.
export default function ItemPicker({ onPick, placeholder = "Search items by name or code, or scan a barcode…", itemType, autoFocus, includeMedicines }: ItemPickerProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [medicines, setMedicines] = useState<CatalogMedicine[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const entries: Entry[] = [
    ...results.map((item) => ({ kind: "item" as const, item })),
    ...medicines.map((medicine) => ({ kind: "medicine" as const, medicine })),
  ];

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setResults([]);
      setMedicines([]);
      return;
    }
    const mine = ++seq.current;
    const handle = setTimeout(async () => {
      try {
        const res = await InventoryService.items({ search: t, itemType, includeMedicines, pageSize: 15 });
        if (mine === seq.current) {
          setResults(res.data);
          setMedicines(res.catalogMedicines ?? []);
          setActive(0);
          setOpen(true);
        }
      } catch {
        // Typing just carries on - the next keystroke tries again.
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [term, itemType, includeMedicines]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (item: InventoryItem, batchId?: string | null) => {
    onPick(item, batchId);
    setTerm("");
    setResults([]);
    setMedicines([]);
    setOpen(false);
  };

  const pickMedicine = async (medicine: CatalogMedicine) => {
    try {
      const res = await InventoryService.itemFromMedicine(medicine.medicineId);
      pick(res.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Couldn't add ${medicine.name ?? "the medicine"}`));
    }
  };

  const choose = (entry: Entry) => (entry.kind === "item" ? pick(entry.item) : void pickMedicine(entry.medicine));

  // Enter: the highlighted result, or (a scanner's Enter) an exact code / barcode / batch label.
  const onEnter = async () => {
    const t = term.trim();
    if (!t) return;
    const exact = results.find((r) => r.code.toLowerCase() === t.toLowerCase() || r.barcode === t);
    if (exact) return pick(exact);
    if (open && entries[active]) return choose(entries[active]);
    try {
      const res = await InventoryService.scan(t);
      pick(res.data.item, res.data.batch?.batchId);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Nothing matches "${t}"`));
    }
  };

  return (
    <div ref={box} className="relative">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-transparent px-3 focus-within:ring-2 focus-within:ring-primary">
        <Search size={15} className="shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={term}
          autoFocus={autoFocus}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => entries.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onEnter();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, entries.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="h-full min-h-0! flex-1 border-0! bg-transparent! p-0! text-sm! shadow-none! focus-visible:ring-0! focus-visible:ring-offset-0!"
        />
        <ScanLine size={15} className="shrink-0 text-muted-foreground" aria-hidden />
      </div>
      {open && entries.length > 0 && (
        <ul className="absolute z-[90] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-xl">
          {entries.map((entry, i) =>
            entry.kind === "item" ? (
              <li key={entry.item.itemId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(entry.item)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? "bg-muted" : "hover:bg-muted"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{entry.item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.item.code} · {entry.item.itemType}
                      {entry.item.category ? ` · ${entry.item.category}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {qty(entry.item.totalStock)} {entry.item.unit}
                  </span>
                </button>
              </li>
            ) : (
              <li key={entry.medicine.medicineId}>
                {i === results.length && (
                  <p className="border-t border-border px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    From the medicine catalog - not stocked yet
                  </p>
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pickMedicine(entry.medicine)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? "bg-muted" : "hover:bg-muted"}`}
                >
                  <Pill size={14} className="shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{entry.medicine.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[entry.medicine.genericName, entry.medicine.dosageForm, entry.medicine.code].filter(Boolean).join(" · ") || "Medicine"}
                    </span>
                  </span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
