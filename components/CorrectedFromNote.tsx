"use client";

import { useState, ReactNode } from "react";
import { History } from "lucide-react";

interface CorrectedFromNoteProps {
  children: ReactNode;
}

export default function CorrectedFromNote({ children }: CorrectedFromNoteProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2"
      >
        <History size={11} />
        corrected — {expanded ? "hide" : "view"} previous
      </button>
      {expanded && (
        <div className="mt-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
