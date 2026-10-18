import type { ToothSurface } from "@/types/dental.type";

export type ToothKind = "incisor" | "canine" | "premolar" | "molar";

export interface ToothInfo {
  number: string;
  isUpper: boolean;
  side: "right" | "left"; // the patient's side
  position: number; // 1 = central incisor … 8 = third molar (5 = second primary molar)
  primary: boolean;
  kind: ToothKind;
  name: string; // e.g. "Upper right first molar"
  // Millimetres: crown height (CEJ to cusp tip / incisal edge), mesiodistal and
  // buccolingual crown widths, the same two widths at the CEJ, and root length.
  crownH: number;
  md: number;
  bl: number;
  cervMd: number;
  cervBl: number;
  rootLen: number;
  rootCount: 1 | 2 | 3;
}

type Dims = [crownH: number, md: number, bl: number, cervMd: number, cervBl: number, rootLen: number, rootCount: 1 | 2 | 3];

// Average textbook crown/root dimensions, indexed by position from the midline.
const ADULT_UPPER: Record<number, Dims> = {
  1: [10.5, 8.5, 7.0, 7.0, 6.0, 13.0, 1],
  2: [9.0, 6.5, 6.0, 5.0, 5.0, 13.0, 1],
  3: [10.0, 7.5, 8.0, 5.5, 7.0, 17.0, 1],
  4: [8.5, 7.0, 9.0, 5.0, 8.0, 14.0, 2],
  5: [8.5, 6.5, 9.0, 5.0, 8.0, 14.0, 1],
  6: [7.5, 10.0, 11.0, 8.0, 10.0, 12.5, 3],
  7: [7.0, 9.0, 11.0, 7.0, 10.0, 12.0, 3],
  8: [6.5, 8.5, 10.0, 6.5, 9.5, 11.0, 3],
};
const ADULT_LOWER: Record<number, Dims> = {
  1: [9.0, 5.0, 6.0, 3.5, 5.3, 12.5, 1],
  2: [9.5, 5.5, 6.5, 4.0, 5.8, 14.0, 1],
  3: [11.0, 7.0, 7.5, 5.5, 7.0, 16.0, 1],
  4: [8.5, 7.0, 7.5, 5.0, 6.5, 14.0, 1],
  5: [8.0, 7.0, 8.0, 5.0, 7.0, 14.5, 1],
  6: [7.5, 11.0, 10.5, 9.0, 9.0, 14.0, 2],
  7: [7.0, 10.5, 10.0, 8.0, 9.0, 13.0, 2],
  8: [7.0, 10.0, 9.5, 7.5, 9.0, 11.0, 2],
};
const PRIMARY_UPPER: Record<number, Dims> = {
  1: [6.0, 6.5, 5.0, 4.5, 4.0, 10.0, 1],
  2: [5.6, 5.1, 4.0, 3.7, 3.7, 11.4, 1],
  3: [6.5, 7.0, 7.0, 5.1, 5.5, 13.5, 1],
  4: [5.1, 7.3, 8.5, 5.2, 6.9, 10.0, 3],
  5: [5.7, 8.2, 10.0, 6.4, 8.3, 11.7, 3],
};
const PRIMARY_LOWER: Record<number, Dims> = {
  1: [5.0, 4.2, 4.0, 3.0, 3.4, 9.0, 1],
  2: [5.2, 4.1, 4.0, 3.0, 3.5, 10.0, 1],
  3: [6.0, 5.0, 4.8, 3.7, 4.0, 11.5, 1],
  4: [6.0, 7.7, 7.0, 6.5, 5.3, 9.8, 2],
  5: [5.5, 9.9, 8.7, 7.2, 6.4, 11.3, 2],
};

const ADULT_NAMES = ["", "central incisor", "lateral incisor", "canine", "first premolar", "second premolar", "first molar", "second molar", "third molar"];
const PRIMARY_NAMES = ["", "central incisor", "lateral incisor", "canine", "first molar", "second molar"];

// Universal numbering: adult 1–16 upper (patient right → left), 17–32 lower (patient left
// → right); primary a–j upper (right → left), k–t lower (left → right).
function locate(n: string): { isUpper: boolean; side: "right" | "left"; position: number; primary: boolean } | null {
  const num = Number(n);
  if (Number.isInteger(num) && num >= 1 && num <= 32) {
    if (num <= 8) return { isUpper: true, side: "right", position: 9 - num, primary: false };
    if (num <= 16) return { isUpper: true, side: "left", position: num - 8, primary: false };
    if (num <= 24) return { isUpper: false, side: "left", position: 25 - num, primary: false };
    return { isUpper: false, side: "right", position: num - 24, primary: false };
  }
  const code = n.toLowerCase().charCodeAt(0) - 97; // a = 0
  if (n.length !== 1 || code < 0 || code > 19) return null;
  if (code <= 4) return { isUpper: true, side: "right", position: 5 - code, primary: true };
  if (code <= 9) return { isUpper: true, side: "left", position: code - 4, primary: true };
  if (code <= 14) return { isUpper: false, side: "left", position: 15 - code, primary: true };
  return { isUpper: false, side: "right", position: code - 14, primary: true };
}

function kindFor(position: number, primary: boolean): ToothKind {
  if (position <= 2) return "incisor";
  if (position === 3) return "canine";
  if (!primary && position <= 5) return "premolar";
  return "molar";
}

export function toothInfo(n: string): ToothInfo {
  const loc = locate(n) ?? { isUpper: true, side: "right" as const, position: 1, primary: false };
  const table = loc.primary
    ? (loc.isUpper ? PRIMARY_UPPER : PRIMARY_LOWER)
    : (loc.isUpper ? ADULT_UPPER : ADULT_LOWER);
  const [crownH, md, bl, cervMd, cervBl, rootLen, rootCount] = table[loc.position];
  const kindName = (loc.primary ? PRIMARY_NAMES : ADULT_NAMES)[loc.position];
  return {
    number: n,
    ...loc,
    kind: kindFor(loc.position, loc.primary),
    name: `${loc.isUpper ? "Upper" : "Lower"} ${loc.side} ${loc.primary ? "primary " : ""}${kindName}`,
    crownH, md, bl, cervMd, cervBl, rootLen, rootCount,
  };
}

export const isAnterior = (kind: ToothKind) => kind === "incisor" || kind === "canine";

// Clinical surface names differ by tooth: front teeth have labial/incisal surfaces, back
// teeth buccal/occlusal; the tongue-side surface of an upper tooth is palatal.
export function surfaceName(surface: ToothSurface, info: Pick<ToothInfo, "kind" | "isUpper">): string {
  const anterior = isAnterior(info.kind);
  switch (surface) {
    case "M": return "Mesial";
    case "D": return "Distal";
    case "B": return anterior ? "Labial" : "Buccal";
    case "L": return info.isUpper ? "Palatal" : "Lingual";
    case "O": return anterior ? "Incisal" : "Occlusal";
  }
}
