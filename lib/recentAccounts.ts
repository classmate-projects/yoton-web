// Accounts that have signed in on this browser, so the login page can offer them as a
// one-tap shortcut. Only what the shortcut needs is kept - never a password or token.
// Stored in localStorage, so it's per-browser and readable by anyone with access to it:
// the login page masks the identifier on screen, but that's display-only, which is why
// every entry can be removed from the login page itself.

export interface RecentAccount {
  userId: string;
  // Exactly what the person typed to sign in (username or email) - needed to sign in again.
  identifier: string;
  initials: string;
  userImage?: string | null;
}

const STORAGE_KEY = "yoton_recent_accounts";
const MAX_ACCOUNTS = 6;

function isRecentAccount(value: unknown): value is RecentAccount {
  const v = value as RecentAccount;
  return (
    !!v &&
    typeof v.userId === "string" &&
    typeof v.identifier === "string" &&
    typeof v.initials === "string"
  );
}

export function getRecentAccounts(): RecentAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecentAccount) : [];
  } catch {
    return [];
  }
}

function save(accounts: RecentAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Storage unavailable (private window, blocked site data) - the shortcut just won't persist.
  }
}

export function rememberAccount(account: RecentAccount) {
  const others = getRecentAccounts().filter((a) => a.userId !== account.userId);
  save([account, ...others].slice(0, MAX_ACCOUNTS));
}

export function forgetAccount(userId: string): RecentAccount[] {
  const remaining = getRecentAccounts().filter((a) => a.userId !== userId);
  save(remaining);
  return remaining;
}

// Shows only the first 3 characters, followed by a fixed run of dots so the true length
// isn't revealed either. Very short identifiers reveal less, so the mask never gives away
// the whole thing.
export function maskIdentifier(identifier: string): string {
  const visible = Math.min(3, Math.max(1, identifier.length - 1));
  return `${identifier.slice(0, visible)}•••••`;
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
