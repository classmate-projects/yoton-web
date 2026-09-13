"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdExpandMore } from "react-icons/md";
import { countryDetails } from "@/helpers/countyDetails";

interface CountrySearchSelectProps {
  value: string; // country name, e.g. "United Arab Emirates"
  onChange: (country: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

// A searchable country-name picker - same popup-with-search-box pattern as
// CountryCodeSelect (see that component's own comment for why this isn't a native
// <select>), just keyed on the country name instead of its dialing code.
export default function CountrySearchSelect({
  value,
  onChange,
  id,
  name,
  placeholder = "Select country",
  required,
  disabled,
  className = "",
}: CountrySearchSelectProps) {
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
  // Set on the trigger's onMouseDown, read (and cleared) by onFocus - a mouse click focuses
  // the button before the click event fires, so onFocus and onClick would otherwise both act
  // on the same click: onFocus opens it, then onClick's toggle immediately closes it again.
  // Marking "this focus came from a mousedown" lets onFocus stand down and leave opening to
  // onClick for mouse interactions, while still opening on focus for real keyboard Tabbing.
  const mouseDownRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countryDetails;
    return countryDetails.filter((c) => c.country.toLowerCase().includes(q));
  }, [query]);

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popupWidth = Math.max(rect.width, 260);
    const estimatedPopupHeight = 320;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.right - popupWidth);
    }
    let top = rect.bottom + 6;
    if (top + estimatedPopupHeight > window.innerHeight - 8 && rect.top - estimatedPopupHeight - 6 > 0) {
      top = rect.top - estimatedPopupHeight - 6;
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
    setHighlighted(Math.max(0, countryDetails.findIndex((c) => c.country === value)));
    setOpen(true);
  };

  const pick = (country: string) => {
    onChange(country);
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
        }}
        onClick={() => (open ? setOpen(false) : openPicker())}
        onFocus={() => {
          // A real Tab into this button should open the list, same as clicking it -
          // otherwise keyboard-only users just see the button's focus ring with no way to
          // tell a list exists at all. Suppressed once right after closeAndRefocus
          // programmatically returns focus here, so that doesn't immediately reopen it.
          if (skipNextFocusOpen.current) {
            skipNextFocusOpen.current = false;
            return;
          }
          if (mouseDownRef.current) {
            // This focus is the browser's own pre-click focus, not a keyboard Tab - let
            // onClick (fired next, on mouseup) handle opening it instead.
            mouseDownRef.current = false;
            return;
          }
          openPicker();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          className ||
          `flex h-11 w-full items-center justify-between gap-1 px-3 text-left text-foreground transition-colors ${
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
          }`
        }
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
        <MdExpandMore size={18} className="text-muted-foreground shrink-0" />
      </button>

      {name && <input type="hidden" name={name} value={value} required={required} />}

      {open && coords && createPortal(
        <div
          ref={popupRef}
          role="listbox"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 flex max-h-80 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
                  if (filtered[highlighted]) pick(filtered[highlighted].country);
                } else if (e.key === "Escape") {
                  closeAndRefocus();
                }
              }}
              placeholder="Search country..."
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div ref={listRef} className="overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No matching country
              </div>
            )}
            {filtered.map((c, index) => (
              <button
                type="button"
                key={c.country}
                role="option"
                aria-selected={c.country === value}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(c.country)}
                className={[
                  "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                  index === highlighted ? "bg-muted" : "",
                  c.country === value ? "font-semibold text-primary" : "text-foreground",
                ].join(" ")}
              >
                <span className="truncate">{c.country}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
