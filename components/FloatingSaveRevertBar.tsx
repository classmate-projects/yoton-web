"use client";

import { RotateCcw, Save } from "lucide-react";

interface FloatingSaveRevertBarProps {
  onRevert: () => void;
  onSave: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  message?: string;
}

// Admin-only affordance for editing data that no longer writes directly (e.g. a finalized
// Encounter) - Save routes through a staged/approval flow instead of an immediate write.
// Gate rendering to admin at the call site; this component itself has no role awareness.
export default function FloatingSaveRevertBar({
  onRevert,
  onSave,
  isSaving,
  saveLabel = "Save",
  message = "Unsaved changes",
}: FloatingSaveRevertBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-2xl">
      <span className="text-sm font-semibold text-foreground/90">{message}</span>
      <button
        type="button"
        onClick={onRevert}
        disabled={isSaving}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
      >
        <RotateCcw size={13} /> Revert
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
      >
        <Save size={13} /> {saveLabel}
      </button>
    </div>
  );
}
