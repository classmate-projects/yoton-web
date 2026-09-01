"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdExpandMore } from "react-icons/md";
import { countryDetails } from "@/helpers/countyDetails";

interface CountryCodeSelectProps {
  value: string; // e.g. "+971"
  onChange: (phoneCode: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

// A searchable replacement for a plain <select> of dialing codes. A native <select> can only
// jump to an option via the browser's own built-in "type the first letter" behavior, and (on
// this form specifically) rendering it with its native text hidden behind a custom overlay -
// the trick previously used to show "+971" without the "- United Arab Emirates" suffix - broke
// under autofill: -webkit-text-fill-color (how autofill paints text) overrides the inline
// color: transparent regardless of author styles, so the native text came back and double-
// painted under the overlay's own copy of it. Building this as its own popup instead of a
// disguised <select> sidesteps both problems at once - there's no native form control here for
// autofill to repaint, and typing in the popup's search box filters by country name or code.
export default function CountryCodeSelect({
  value,
  onChange,
  id,
  name,
  required,
  disabled,
  className = "",
}: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Popup is portaled to document.body (see render below) so it can't be clipped by an
  // ancestor's `overflow: hidden` - that means it needs its own viewport-relative coordinates
  // instead of relying on `position: absolute` + a `relative` wrapper.
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  // Set right before programmatically refocusing the trigger (closeAndRefocus below) so that
  // refocus's own onFocus doesn't immediately reopen what was just closed - the trigger's
  // onFocus otherwise can't tell "a real Tab into this button" (should open) apart from "we
  // just returned focus here ourselves" (shouldn't).
  const skipNextFocusOpen = useRef(false);

  // Matches on country name OR dialing code, either with or without the leading "+" - typing
  // "ind" finds India/Indonesia, typing "91" or "+91" both find India's code.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return countryDetails;
    return countryDetails.filter(
      (c) => c.country.toLowerCase().includes(q) || c.phoneCode.replace("+", "").includes(q),
    );
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
    setHighlighted(Math.max(0, countryDetails.findIndex((c) => c.phoneCode === value)));
    setOpen(true);
  };

  const pick = (phoneCode: string) => {
    onChange(phoneCode);
    closeAndRefocus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
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
          openPicker();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          className ||
          `flex h-11 shrink-0 items-center gap-1 px-3 text-foreground transition-colors ${
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
          }`
        }
      >
        <span className="font-medium">{value}</span>
        <MdExpandMore size={18} className="text-muted-foreground" />
      </button>

      {/* Hidden input so this still participates in native form semantics without
          rendering a second visible control. */}
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
                  if (filtered[highlighted]) pick(filtered[highlighted].phoneCode);
                } else if (e.key === "Escape") {
                  closeAndRefocus();
                }
              }}
              placeholder="Search country or code..."
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div ref={listRef} className="overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No matching country or code
              </div>
            )}
            {filtered.map((c, index) => (
              <button
                type="button"
                key={c.country}
                role="option"
                aria-selected={c.phoneCode === value}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(c.phoneCode)}
                className={[
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                  index === highlighted ? "bg-muted" : "",
                  c.phoneCode === value ? "font-semibold text-primary" : "text-foreground",
                ].join(" ")}
              >
                <span className="truncate">{c.country}</span>
                <span className="shrink-0 text-muted-foreground">{c.phoneCode}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
