// Quantities held in an item's own unit (a medicine's strips, say), read the way they sit on the
// shelf: whole packs, plus what's left loose from an opened one - "3 Box + 4 Strip". Without a
// pack (or less than one pack's worth) it's just the quantity and unit.

const tidy = (n: number) => Number(n.toFixed(3)).toLocaleString();

export function packText(quantity: number, unit: string, packUnit?: string | null, packSize?: number | null): string {
  const q = Number(quantity) || 0;
  if (!packUnit || !packSize || packSize <= 1 || q < packSize) return `${tidy(q)} ${unit}`;
  const packs = Math.floor(q / packSize + 1e-9);
  const loose = Number((q - packs * packSize).toFixed(3));
  return loose > 0 ? `${tidy(packs)} ${packUnit} + ${tidy(loose)} ${unit}` : `${tidy(packs)} ${packUnit}`;
}

// "Box of 10 Strip" - or nothing when the item has no pack.
export function packLabel(unit: string, packUnit?: string | null, packSize?: number | null): string | null {
  return packUnit && packSize && packSize > 1 ? `${packUnit} of ${tidy(packSize)} ${unit}` : null;
}
