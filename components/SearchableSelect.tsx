"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdExpandMore } from "react-icons/md";

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
    const estimatedPopupHeight = 280;
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
      if (e.key === "Escape") setOpen(false);
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
    setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          className ||
          `flex h-11 w-full items-center justify-between gap-1 px-3 text-left capitalize text-foreground transition-colors ${
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
          }`
        }
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
          {selected?.label || placeholder}
        </span>
        <MdExpandMore size={18} className="text-muted-foreground shrink-0" />
      </button>

      {name && <input type="hidden" name={name} value={value} required={required} />}

      {open && coords && createPortal(
        <div
          ref={popupRef}
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
                  setOpen(false);
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
                  "flex w-full items-center px-3 py-2 text-left text-sm capitalize transition-colors",
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
