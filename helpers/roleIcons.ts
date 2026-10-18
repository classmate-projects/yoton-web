import { fas } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// Role.iconKey stores a Font Awesome Free "solid" icon name (e.g. "stethoscope"), picked via
// the picker in Role Management (components/RoleIconPicker.tsx) - not raw emoji (dropped
// after the OS-dependent rendering looked inconsistent) and not a small hand-curated set
// (outgrown once "any icon the admin wants" was the actual ask). Font Awesome's icon names
// form their own large-but-closed, SVG-rendered registry, which is exactly the property we
// want: broad choice, consistent rendering across OS/browser, and a real fixed universe a
// bad/typo'd key just falls back out of instead of breaking. Mirror any change to
// PICKER_ICON_NAMES in Yoton-API/Helpers/RoleIconHelper.cs's length cap if the longest name
// changes meaningfully.
const ALL_ICONS: Record<string, IconDefinition> = fas as unknown as Record<string, IconDefinition>;

const ICON_BY_NAME: Map<string, IconDefinition> = new Map(
  Object.values(ALL_ICONS)
    .filter((icon): icon is IconDefinition => !!icon && typeof icon === "object" && "iconName" in icon)
    .map((icon) => [icon.iconName, icon])
);

export const DEFAULT_ROLE_ICON_KEY = "user";

// A hand-picked healthcare-relevant starting set shown before the admin types a search term
// - the full ~2000-icon set only renders once they search, to keep the picker light.
export const SUGGESTED_ROLE_ICON_KEYS = [
  "user-doctor",
  "user-nurse",
  "stethoscope",
  "heart-pulse",
  "flask",
  "vial",
  "microscope",
  "x-ray",
  "syringe",
  "pills",
  "prescription-bottle-medical",
  "tooth",
  "brain",
  "eye",
  "bone",
  "wheelchair",
  "bed-pulse",
  "ambulance",
  "notes-medical",
  "file-medical",
  "book-medical",
  "hand-holding-medical",
  "user-injured",
  "id-card",
  "credit-card",
  "building",
  "clipboard-list",
  "shield-halved",
  "thermometer",
  "weight-scale",
];

export function getRoleIcon(iconKey: string | null | undefined): IconDefinition {
  return (iconKey && ICON_BY_NAME.get(iconKey)) || ICON_BY_NAME.get(DEFAULT_ROLE_ICON_KEY)!;
}

export function searchRoleIcons(query: string, limit = 120): { key: string; icon: IconDefinition }[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return SUGGESTED_ROLE_ICON_KEYS.map((key) => ({ key, icon: ICON_BY_NAME.get(key) })).filter(
      (i): i is { key: string; icon: IconDefinition } => !!i.icon
    );
  }
  const results: { key: string; icon: IconDefinition }[] = [];
  for (const icon of ICON_BY_NAME.values()) {
    if (icon.iconName.includes(q)) {
      results.push({ key: icon.iconName, icon });
      if (results.length >= limit) break;
    }
  }
  return results;
}
