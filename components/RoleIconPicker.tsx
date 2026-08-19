"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getRoleIcon, searchRoleIcons } from "@/helpers/roleIcons";

interface RoleIconPickerProps {
  value: string;
  onChange: (iconKey: string) => void;
}

// Font Awesome Free icon picker for a role's sidebar tile - see helpers/roleIcons.ts for why
// Font Awesome (broad, consistently-rendered, still a real closed registry) over raw emoji
// or the earlier 10-icon hand-curated set.
export default function RoleIconPicker({ value, onChange }: RoleIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = searchRoleIcons(query);

  const pick = (iconKey: string) => {
    onChange(iconKey);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm hover:bg-muted cursor-pointer"
      >
        <FontAwesomeIcon icon={getRoleIcon(value)} size="lg" />
        <span className="text-muted-foreground">Choose icon</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card w-full max-w-md rounded-xl border border-border p-5 shadow-2xl mx-4"
          >
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons..."
              className="w-full mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="grid grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
              {results.map(({ key, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  title={key}
                  aria-label={key}
                  className={`flex h-13 w-13 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                    value === key
                      ? "border-purple-600 bg-purple-100 text-purple-600 dark:bg-purple-950/40"
                      : "border-border text-muted-foreground hover:border-purple-300"
                  }`}
                >
                  <FontAwesomeIcon icon={icon} size="lg" />
                </button>
              ))}
              {results.length === 0 && (
                <p className="col-span-6 py-6 text-center text-sm text-muted-foreground">No icons match &quot;{query}&quot;</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
