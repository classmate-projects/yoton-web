"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

interface HintTooltipProps {
  text: string;
}

export default function HintTooltip({ text }: HintTooltipProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  };

  const hide = () => setCoords(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="flex items-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help"
        tabIndex={-1}
        aria-label="Help"
      >
        <CircleHelp size={13} />
      </button>

      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] w-56 -translate-x-1/2 -translate-y-full rounded-lg bg-gray-800 dark:bg-gray-900 px-2.5 py-2 text-xs text-white shadow-xl pointer-events-none"
            style={{ top: coords.top, left: coords.left }}
          >
            {text}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-900" />
          </div>,
          document.body
        )}
    </>
  );
}
