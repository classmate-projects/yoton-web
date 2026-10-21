"use client";

import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { addressErrors, formatAddressLine, hasAnyAddressValue, type AddressValues } from "@/lib/region";
import type { Region } from "@/types/region.type";

interface RegionAddressFieldsProps {
  region: Region | null;
  values: AddressValues;
  onChange: (values: AddressValues) => void;
  // The one-line address already on file for a record saved before structured addresses
  // (or under another country) - shown so it isn't lost from view; it stays as saved unless
  // the fields below are filled in.
  savedLine?: string;
  // Show each field's own error (after a submit attempt).
  showErrors?: boolean;
  inputClassName?: string;
}

// The patient address in the installation's country's own structure - building / street /
// zone / municipality in Qatar, flat / building / area / emirate in the UAE, house / street /
// district / state / PIN in India (RegionProfile.AddressFields on the API, which checks the
// same rules and builds the same one-line address for printouts and lists).
export default function RegionAddressFields({
  region,
  values,
  onChange,
  savedLine,
  showErrors = false,
  inputClassName = "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
}: RegionAddressFieldsProps) {
  const fields = region?.addressFields ?? [];
  if (fields.length === 0) return null;

  const errors = showErrors ? addressErrors(fields, values) : {};
  const line = formatAddressLine(fields, values);
  const set = (key: string, value: string) => onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      {savedLine && !hasAnyAddressValue(values) && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          On file: <span className="text-foreground">{savedLine}</span> - fill in the fields below to replace it.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={`address-${f.key}`} className="text-xs font-medium text-muted-foreground">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
            {f.options && f.options.length > 0 ? (
              <SearchableSelect
                id={`address-${f.key}`}
                value={values[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
                options={f.options.map((o) => ({ value: o, label: o }))}
                placeholder={`Select ${f.label.toLowerCase()}`}
                preserveCase
                className={fieldSelectClass}
              />
            ) : (
              <input
                id={`address-${f.key}`}
                type="text"
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder ?? ""}
                aria-invalid={!!errors[f.key]}
                className={`${inputClassName} ${errors[f.key] ? "border-red-500" : ""}`}
              />
            )}
            {errors[f.key] && <p className="text-xs text-red-500">{errors[f.key]}</p>}
          </div>
        ))}
      </div>
      {line && <p className="text-xs text-muted-foreground">Address line: {line}</p>}
    </div>
  );
}
