"use client";

import { illustrations, type IllustrationName } from "@/components/illustrations";

// Artwork lives in components/illustrations/ (one file per illustration); this component only
// lays out the picture, title, description and optional action.
type EmptyStateProps = {
  illustration: IllustrationName;
  title: string;
  description?: string;
  // Optional one-click way out - e.g. clearing the filter that hid everything.
  action?: { label: string; onClick: () => void };
  // "compact" for side panels, modals and narrow columns.
  size?: "default" | "compact";
};

export default function EmptyState({ illustration, title, description, action, size = "default" }: EmptyStateProps) {
  const compact = size === "compact";
  const Illustration = illustrations[illustration];
  return (
    // whitespace-normal/normal-case: several of these sit inside table cells, which may
    // inherit nowrap or uppercase from the table's own styling.
    <div className={`flex flex-col items-center justify-center whitespace-normal px-4 text-center normal-case ${compact ? "py-6" : "py-12"}`}>
      <div className={compact ? "mb-3 h-24 w-28" : "mb-4 h-32 w-40 sm:h-36 sm:w-44"}>
        <Illustration />
      </div>
      <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm font-normal text-muted-foreground">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
