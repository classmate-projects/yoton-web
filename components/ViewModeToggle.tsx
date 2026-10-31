"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/hooks/useViewModePreference";

const OPTIONS = [
  { mode: "list", label: "List view", Icon: List },
  { mode: "grid", label: "Grid view", Icon: LayoutGrid },
] as const;

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
};

// List/grid icon switch - pair with useViewModePreference so the choice is remembered.
export default function ViewModeToggle({ value, onChange, className = "" }: ViewModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Choose layout"
      className={`flex h-11 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm ${className}`}
    >
      {OPTIONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          title={label}
          aria-label={label}
          aria-pressed={value === mode}
          className={`flex h-full w-9 items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            value === mode
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  );
}
