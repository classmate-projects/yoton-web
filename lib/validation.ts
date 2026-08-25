// Shared, lightweight validation helpers - not full RFC 5322 (that grammar is absurdly
// permissive and mostly useless for catching real typos), just "does this look like a
// real email address": one @, something on both sides, a dot in the domain, no spaces.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}
