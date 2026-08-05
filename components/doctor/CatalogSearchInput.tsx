"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

interface CatalogOption {
  id: string;
  name: string;
  code?: string | null;
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchOptions(query);
        setOptions(results);
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
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
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
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
              >
                <span className="text-foreground">{opt.name}</span>
                {opt.code && <span className="text-xs text-muted-foreground">{opt.code}</span>}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches found.</p>
          )}
        </div>
      )}
    </div>
  );
}
