"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";

export interface SortMenuOption {
  value: string;
  label: string;
}

interface SortMenuProps {
  // The field to sort on (e.g. "reg" | "name").
  fieldValue: string;
  onFieldChange: (value: string) => void;
  fieldOptions: SortMenuOption[];
  // Sort direction.
  dirValue: "asc" | "desc";
  onDirChange: (value: "asc" | "desc") => void;
  className?: string;
}

// A single dropdown holding two independent, section-separated choices: which field to
// sort by, and the direction. Unlike SearchableSelect (one value), both selections live
// together in one popover - a field section on top, an order section below a divider.
export default function SortMenu({
  fieldValue,
  onFieldChange,
  fieldOptions,
  dirValue,
  onDirChange,
  className = "",
}: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedField = fieldOptions.find((o) => o.value === fieldValue);

  const Row = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted ${
        active ? "font-semibold text-primary" : "text-foreground"
      }`}
    >
      <span className="truncate">{label}</span>
      {active && <Check size={16} className="shrink-0" />}
    </button>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-primary/60 cursor-pointer ${className}`}
      >
        <ArrowUpDown size={16} className="text-muted-foreground shrink-0" />
        <span className="truncate">{selectedField?.label ?? "Sort"}</span>
        <span className="text-muted-foreground shrink-0">{dirValue === "asc" ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[300] mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sort by
          </div>
          {fieldOptions.map((o) => (
            <Row
              key={o.value}
              active={o.value === fieldValue}
              label={o.label}
              onClick={() => onFieldChange(o.value)}
            />
          ))}

          <div className="my-1.5 border-t border-border" />

          <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Order
          </div>
          <Row active={dirValue === "desc"} label="Descending" onClick={() => onDirChange("desc")} />
          <Row active={dirValue === "asc"} label="Ascending" onClick={() => onDirChange("asc")} />
        </div>
      )}
    </div>
  );
}
