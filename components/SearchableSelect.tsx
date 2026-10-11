"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdExpandMore } from "react-icons/md";

// Trigger style for a SearchableSelect that stands on its own (e.g. a page-header picker)
// rather than inside a form field that already draws the box - the default trigger is
// borderless, which on its own reads as plain text instead of a dropdown. Pass as className.
export const standaloneSelectClass =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

// Generic searchable dropdown for any small option list (roles, departments,
// specializations, ...) - same popup-with-search-box pattern as CountryCodeSelect/
// CountrySearchSelect, kept as its own component since those two are keyed
// specifically to the country reference list, while this one takes arbitrary options.
export default function SearchableSelect({
  value,
  onChange,
  options,
  id,
  name,
  placeholder = "Select...",
  required,
  disabled,
  className = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  // Set right before programmatically refocusing the trigger (closeAndRefocus below) so that
  // refocus's own onFocus doesn't immediately reopen what was just closed - the trigger's
  // onFocus otherwise can't tell "a real Tab into this button" (should open) apart from "we
  // just returned focus here ourselves" (shouldn't).
  const skipNextFocusOpen = useRef(false);
  // Set for the duration of a mouse-initiated click (mousedown through the click a few
  // milliseconds later) so onFocus can tell that apart from a real keyboard Tab into the
  // button. Without this, clicking an unfocused trigger fires both events - onFocus opens
  // it first, then onClick's own toggle (reading `open` as still false from before that
  // update takes effect) opens it "again", which React resolves as toggling back off,
  // making the very first click open the popup for a single frame and immediately close it.
  // Cleared via a same-tick timeout rather than in onClick, so it also self-heals if the
  // mouse is dragged off before releasing (no click ever fires to clear it).
  const mouseDownRef = useRef(false);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popupWidth = Math.max(rect.width, 220);
    // Before the popup has ever rendered there's nothing to measure, so fall back to a
    // rough estimate for that one frame - the layout effect below immediately re-measures
    // against the popup's real (usually much shorter) height and corrects this before
    // paint. Without that correction, a short list flipped "above" by the full estimate
    // instead of its actual height, landing the popup nowhere near its own trigger.
    const popupHeight = popupRef.current?.getBoundingClientRect().height || 280;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.right - popupWidth);
    }

    let top: number;
    if (popupHeight <= spaceBelow || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
    } else {
      top = Math.max(8, rect.top - popupHeight - 6);
    }
    setCoords({ top, left, width: popupWidth });
  };

  // Closes the popup and returns focus to the trigger button - without this, closing via
  // Enter/Escape leaves focus stranded on whatever popup element (search box, option) is
  // about to unmount, so the very next Tab press jumps somewhere unrelated instead of
  // continuing on to the form's next field, the way a native <select> would.
  const closeAndRefocus = () => {
    setOpen(false);
    skipNextFocusOpen.current = true;
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    searchRef.current?.focus();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = wrapperRef.current?.contains(target);
      const insidePopup = popupRef.current?.contains(target);
      if (!insideWrapper && !insidePopup) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAndRefocus();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  // The popup is only in the DOM once `coords` holds a non-null value, so the very first
  // updateCoords() call above (still in the "open" effect) necessarily runs before it
  // exists and falls back to the 280px estimate. This ref callback fires the instant the
  // portal's div actually mounts, letting updateCoords() immediately re-measure against
  // its real (often much shorter) height and correct the estimate - before paint, since
  // ref callbacks run in the same commit-time window as layout effects. Must be memoized:
  // an inline ref function gets a new identity every render, which would re-fire (and
  // re-setCoords, and re-render, and re-fire...) on every keystroke instead of just once
  // per mount.
  const setPopupRef = useCallback((node: HTMLDivElement | null) => {
    popupRef.current = node;
    if (node) updateCoords();
  }, []);

  // Separately, re-measure whenever the mounted popup's own content height changes (e.g.
  // typing narrows the filtered list) - the callback ref above only fires on mount/unmount,
  // not on this kind of in-place resize.
  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, filtered.length]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const openPicker = () => {
    if (disabled) return;
    setQuery("");
    setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (optionValue: string) => {
    onChange(optionValue);
    closeAndRefocus();
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
        onMouseDown={() => {
          mouseDownRef.current = true;
          setTimeout(() => {
            mouseDownRef.current = false;
          }, 0);
        }}
        onClick={() => (open ? setOpen(false) : openPicker())}
        onFocus={() => {
          // A real Tab into this button should open the list, same as clicking it -
          // otherwise keyboard-only users just see the button's focus ring with no way to
          // tell a list exists at all. Suppressed once right after closeAndRefocus
          // programmatically returns focus here, so that doesn't immediately reopen it, and
          // suppressed for a mouse click's own focus (onClick's toggle already handles that).
          if (skipNextFocusOpen.current) {
            skipNextFocusOpen.current = false;
            return;
          }
          if (mouseDownRef.current) return;
          openPicker();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${
          className ||
          "flex h-10 w-full items-center justify-between gap-1 rounded-lg border border-border bg-background px-3 text-left capitalize text-foreground transition-colors hover:border-primary/60"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
          {selected?.label || placeholder}
        </span>
        <MdExpandMore size={18} className="text-muted-foreground shrink-0" />
      </button>

      {name && <input type="hidden" name={name} value={value} required={required} />}

      {open && coords && createPortal(
        <div
          ref={setPopupRef}
          role="listbox"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 flex max-h-72 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlighted((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[highlighted]) pick(filtered[highlighted].value);
                } else if (e.key === "Escape") {
                  closeAndRefocus();
                }
              }}
              placeholder="Search..."
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div ref={listRef} className="overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No matches found</div>
            )}
            {filtered.map((o, index) => (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(o.value)}
                className={[
                  "flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm capitalize transition-colors",
                  index === highlighted ? "bg-muted" : "",
                  o.value === value ? "font-semibold text-primary" : "text-foreground",
                ].join(" ")}
              >
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
