// Shared, lightweight validation helpers - not full RFC 5322 (that grammar is absurdly
// permissive and mostly useless for catching real typos), just "does this look like a
// real email address": one @, something on both sides, a dot in the domain, no spaces.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

// Every nationality can present a passport, and passport numbering isn't standardized
// enough per-country to validate more precisely than this: letters and digits, 6-9
// characters (covers the common ICAO 9303 case). Same rule as the API's
// PatientIdentityHelper.PassportRegexPattern.
export const passportNumberRegex = /^[A-Za-z0-9]{6,9}$/;
