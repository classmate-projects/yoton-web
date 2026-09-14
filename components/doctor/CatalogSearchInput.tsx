"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

interface CatalogOption {
  id: string;
  name: string;
  code?: string | null;
  meta?: string | null; // optional subtitle line, e.g. "Generic: Paracetamol · Stock: 120"
}

interface CatalogSearchInputProps {
  placeholder: string;
  fetchOptions: (search: string) => Promise<CatalogOption[]>;
  onSelect: (option: CatalogOption) => void;
  value?: string;
}

// Debounced type-ahead search box shared by every "pick from an admin-managed catalog"
// field in the doctor workbench (diagnosis, investigation, treatment, medication drug
// name). Selecting a result clears the box — the caller owns display of what was picked.
export default function CatalogSearchInput({ placeholder, fetchOptions, onSelect, value }: CatalogSearchInputProps) {
  const [query, setQuery] = useState(value || "");
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Popup is portaled to document.body (see render below) so it can't be clipped by an
  // ancestor's overflow-y-auto - this field sits inside the encounter form's own scrolling
  // card, which clipped the plain absolutely-positioned dropdown that used to render here
  // (looked like results were "cropped" right at the card's edge). Needs its own viewport-
  // relative coordinates instead of relying on position:absolute + a relative wrapper.
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateCoords = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insidePopup = popupRef.current?.contains(target);
      if (!insideTrigger && !insidePopup) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const results = await fetchOptions(query);
        setOptions(results);
      } catch {
        // A 403 (missing module grant) or network failure otherwise left this looking
        // identical to "no matches found" with no way to tell the difference — see the
        // dropdown's own hasError branch below for the distinct message.
        setOptions([]);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          className="w-full h-10 pl-9 text-sm"
        />
      </div>
      {isOpen && coords && createPortal(
        <div
          ref={popupRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
          ) : hasError ? (
            <p className="px-3 py-2 text-sm text-red-600">Search failed. Please try again.</p>
          ) : options.length > 0 ? (
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
              >
                <span className="flex flex-col">
                  <span className="text-foreground">{opt.name}</span>
                  {opt.meta && <span className="text-xs text-muted-foreground">{opt.meta}</span>}
                </span>
                {opt.code && <span className="text-xs text-muted-foreground shrink-0">{opt.code}</span>}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches found.</p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
