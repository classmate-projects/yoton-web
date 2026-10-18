"use client";

import { useRef } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { placeholderToken } from "@/lib/medicalForm";
import { FormPlaceholderType } from "@/types/medicalForm.type";

const pickerClass =
  "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-dashed border-border bg-card px-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary";

// A text input (or textarea) plus an "Insert patient data" picker that drops a {{token}} at
// the cursor - the token is replaced with that patient's details wherever the form is opened.
export default function PlaceholderTextInput({
  value,
  onChange,
  catalog,
  multiline = false,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  catalog: FormPlaceholderType[];
  multiline?: boolean;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // The input keeps its selection after losing focus to the picker, so this lands where the
  // designer's cursor was (or at the end if they never clicked into it).
  const insert = (key: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + placeholderToken(key) + value.slice(end));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {multiline ? (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      ) : (
        <input
          ref={(el) => {
            inputRef.current = el;
          }}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-sm"
        />
      )}
      {catalog.length > 0 && (
        <div className="w-56">
          <SearchableSelect
            value=""
            onChange={(key) => key && insert(key)}
            options={catalog.map((p) => ({ value: p.key, label: `${p.group}: ${p.label}` }))}
            placeholder="+ Insert patient data"
            className={pickerClass}
          />
        </div>
      )}
    </div>
  );
}
