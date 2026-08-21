// Deterministic background color for a user's initials-fallback avatar, so two different
// people who both haven't uploaded a photo never render as visually identical (which is what
// actually happened - doctor and nurse both had userImage=null and fell through to the same
// flat placeholder color, easy to mistake for "the same picture leaking between users").
// Hashed from a stable per-user value (userId, falling back to name) - same person always
// gets the same color, two different people get visually distinct ones almost every time.
const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#d946ef", "#ec4899",
];

export function getAvatarColor(seed: string | null | undefined): string {
  if (!seed) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
