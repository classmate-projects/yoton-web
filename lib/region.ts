import { useSyncExternalStore } from "react";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import type { Region, RegionAddressField, RegionFeature } from "@/types/region.type";

// The installation's country/region, as delivered with the sign-in and /me responses and kept
// in the stored user detail. The single place every page reads country-specific rules from -
// currency, phone code, national ID, address fields, tax and country-only features - so
// nothing hardcodes one country. Null only before the super administrator has chosen one
// (no clinic user can sign in then anyway).
export function getRegion(): Region | null {
  return getUserDetail()?.region ?? null;
}

// Cached by the raw stored value so useSyncExternalStore gets a stable snapshot.
let cachedRaw: string | null | undefined;
let cachedRegion: Region | null = null;

function regionSnapshot(): Region | null {
  const raw = typeof window === "undefined" ? null : localStorage.getItem("yoton_user_detail");
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedRegion = getRegion();
  }
  return cachedRegion;
}

// React hook form of getRegion() - re-renders when the stored user detail changes (e.g. the
// super administrator switched the country and this session refreshed it).
export function useRegion(): Region | null {
  return useSyncExternalStore(onUserDetailChange, regionSnapshot, () => null);
}

// The region's own dialing code ("+974") - the default for every phone field. Read straight
// from storage so it can seed a form's initial state.
export function defaultDialCode(): string {
  return getRegion()?.phone.dialCode ?? "";
}

export function hasRegionFeature(region: Region | null, feature: RegionFeature): boolean {
  return region?.features.includes(feature) ?? false;
}

// "National ID" when no region is known yet.
export function nationalIdLabel(region: Region | null): string {
  return region?.nationalId.label ?? "National ID";
}

// Checks a national ID typed into a form against the region's format. Spaces and dashes are
// ignored for the check (the API stores each region's canonical form - e.g. a QID as 11
// plain digits, an Emirates ID with its dashes), so the person typing doesn't have to get the
// separators exactly right. Returns the error to show, or null.
export function nationalIdError(region: Region | null, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !region) return null;
  const pattern = new RegExp(region.nationalId.pattern);
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  const candidates = [trimmed, digitsOnly, formatLikePlaceholder(digitsOnly, region.nationalId.placeholder)];
  return candidates.some((c) => pattern.test(c))
    ? null
    : `${region.nationalId.label} format looks incorrect. Expected e.g. ${region.nationalId.placeholder}.`;
}

// The ID in the region's stored form - separators placed as in its placeholder
// ("784-1234-5678901-2", "1234 5678 9012", plain digits for a QID). Mirrors the API's
// normalizer; anything that doesn't fit the format is returned as typed so the format check
// can point it out.
export function normalizeNationalId(region: Region | null, raw: string): string {
  const trimmed = raw.trim();
  if (!region || !trimmed) return trimmed;
  const formatted = formatLikePlaceholder(trimmed.replace(/[\s-]/g, ""), region.nationalId.placeholder);
  return new RegExp(region.nationalId.pattern).test(formatted) ? formatted : trimmed;
}

// Re-applies the placeholder's separators to bare digits ("784123412345671" -> "784-1234-1234567-1").
function formatLikePlaceholder(digits: string, placeholder: string): string {
  let out = "";
  let i = 0;
  for (const ch of placeholder) {
    if (i >= digits.length) break;
    if (/\d/.test(ch)) out += digits[i++];
    else out += ch;
  }
  return i === digits.length ? out : digits;
}

// Checks a local phone number against the region (exact length for the region's own dial
// code, 6-15 digits for any other). Mirrors RegionProfile.ValidatePhone on the API.
export function phoneError(region: Region | null, dialCode: string | undefined, phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (region && dialCode === region.phone.dialCode) {
    return digits.length === region.phone.nationalNumberLength
      ? null
      : `${region.country} mobile numbers have ${region.phone.nationalNumberLength} digits after ${region.phone.dialCode} (e.g. ${region.phone.example})`;
  }
  return digits.length >= 6 && digits.length <= 15 ? null : "Mobile number looks incorrect";
}

export type AddressValues = Record<string, string>;

// Errors per address field (required / fixed list / pattern), empty when the address is fine.
// Mirrors RegionProfile.NormalizeAddress on the API.
export function addressErrors(fields: RegionAddressField[], values: AddressValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) {
      if (f.required) errors[f.key] = `${f.label} is required`;
      continue;
    }
    if (f.options && f.options.length > 0 && !f.options.some((o) => o.toLowerCase() === v.toLowerCase())) errors[f.key] = `Choose a ${f.label.toLowerCase()} from the list`;
    else if (f.pattern && !new RegExp(f.pattern).test(v)) errors[f.key] = f.patternMessage ?? `${f.label} format looks incorrect`;
  }
  return errors;
}

// The one-line address the API builds from the fields ("Unit 5, Building 12, Zone 25, Doha").
export function formatAddressLine(fields: RegionAddressField[], values: AddressValues): string {
  return fields
    .map((f) => {
      const v = (values[f.key] ?? "").trim();
      return v ? (f.prefix ? `${f.prefix} ${v}` : v) : "";
    })
    .filter(Boolean)
    .join(", ");
}

export function hasAnyAddressValue(values: AddressValues): boolean {
  return Object.values(values).some((v) => (v ?? "").trim().length > 0);
}
