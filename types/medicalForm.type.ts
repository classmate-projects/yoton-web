// Field types supported so far. Image marking and signature are later-phase additions - the
// field tree is just JSON on the backend, so adding a new type here needs no API change,
// only a new case in MedicalFormRenderer.
export type MedicalFormFieldType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "text"
  | "textarea"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "number"
  | "date"
  | "datetime"
  // A duplicatable section (spec: "multiple wounds, multiple readings") - a labeled
  // container of childFields, filled and repeated as a whole row at a time. Its value is
  // an array of per-row values maps (MedicalFormValues[]), not a single value like every
  // other field type.
  | "group"
  // A diagram/body-chart/illustration (spec 2) - the base image is uploaded once while
  // building the field (imagePath), the same picture for every patient this form is filled
  // for. Its value is the list of markings drawn on top for THIS one filled instance.
  | "image"
  // Captured once per fill as a base64 PNG data URL (the plain `string` member of
  // MedicalFormFieldValue) - see components/medicalForms/SignaturePad.tsx.
  | "signature";

export type FieldAlign = "left" | "center" | "right";

export interface FieldFormatting {
  align: FieldAlign;
  fontSize: string; // Tailwind text-size token, e.g. "text-sm" | "text-base" | "text-lg" | "text-xl" | "text-2xl"
  color: string; // hex, e.g. "#1f2937"
  backgroundColor: string; // hex, or "transparent" for no cell background
  bold: boolean;
  italic: boolean;
  underline: boolean;
  marginTop: number;
  marginBottom: number;
  paddingX: number;
  paddingY: number;
}

export const DEFAULT_FORMATTING: FieldFormatting = {
  align: "left",
  fontSize: "text-base",
  color: "#1f2937",
  backgroundColor: "transparent",
  bold: false,
  italic: false,
  underline: false,
  marginTop: 0,
  marginBottom: 8,
  paddingX: 0,
  paddingY: 0,
};

// One selectable choice (checkbox/radio/dropdown), optionally carrying its own score.
export interface MedicalFormFieldOption {
  value: string;
  score?: number;
}

export interface MedicalFormFieldScoring {
  enabled: boolean;
  // Populated for checkbox/radio/dropdown (one entry per option, mirrors `options` by value).
  // Left empty for a scored text/number field, where the entered value itself is the score.
  options: MedicalFormFieldOption[];
  // The "normal" band for this field's own score contribution - below lowerLimit or above
  // upperLimit is abnormal. Either end left unset means unbounded on that side. Compared
  // against the same number a scored choice field's selected option carries, or the raw
  // entered value for a scored text/number field - i.e. exactly what ComputeScore already
  // sums per field, just checked per-field here instead of totaled.
  lowerLimit?: number;
  upperLimit?: number;
}

export interface MedicalFormField {
  id: string;
  type: MedicalFormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  formatting: FieldFormatting;
  headingLevel?: "h1" | "h2" | "h3"; // only meaningful for type "heading"
  options?: string[]; // choice labels for checkbox/radio/dropdown - MedicalFormFieldOption.value mirrors these
  scoring?: MedicalFormFieldScoring;
  childFields?: MedicalFormField[]; // only meaningful for type "group" - the per-row field template (flat, no columns - a repeatable section's own row is small enough that up/down reordering is enough)
  maxDuplicates?: number; // only meaningful for type "group" - unlimited rows when unset
  imagePath?: string; // only meaningful for type "image" - the backend-relative uploaded path
  // Only meaningful for type "image" - display width in px, dragged from the builder's live
  // preview (see ImageAnnotationCanvas's resize handle). Unset means natural size (capped to
  // its container's width).
  imageWidth?: number;
}

// The top-level field tree is an ordered list of rows, each holding 1+ fields rendered side
// by side as columns - array position is authoritative for both row order and column order
// within a row (no separate `order` field to keep in sync after a drag-and-drop move).
export interface MedicalFormRow {
  id: string;
  fields: MedicalFormField[];
}

// Templates built before rows/columns existed have FieldsJson as a flat MedicalFormField[]
// instead - detects that shape (no `.fields` array on its entries) and wraps each field into
// its own single-field row, so a template created before this change still opens instead of
// crashing on `row.fields.map`. New saves are always already row-shaped, so this is a one-way
// read-time upgrade, not something every save needs to round-trip through.
export function normalizeRows(parsed: unknown): MedicalFormRow[] {
  if (!Array.isArray(parsed)) return [];
  if (parsed.length === 0) return [];

  const looksLikeRow = (item: unknown): item is MedicalFormRow =>
    typeof item === "object" && item !== null && Array.isArray((item as { fields?: unknown }).fields);

  if (parsed.every(looksLikeRow)) return parsed;

  return (parsed as MedicalFormField[]).map((field, index) => ({
    id: `row-legacy-${index}`,
    fields: [field],
  }));
}

export type MarkingShapeType = "circle" | "arrow" | "highlight" | "text";

// One drawn marking on an "image" field. x/y (and x2/y2/radius, where used) are normalized
// 0-1 fractions of the image's own width/height rather than pixels, so a marking still lands
// in the right place regardless of what size the image happens to render at (a modal on a
// phone vs. a wide desktop card) - the same convention avoids needing to know the image's
// natural pixel dimensions at all, on either the fill or the view side.
export interface ImageMarking {
  id: string;
  type: MarkingShapeType;
  color: string;
  x: number;
  y: number;
  x2?: number; // arrow end point, or highlight's opposite corner
  y2?: number;
  radius?: number; // circle only
  text?: string; // text annotation only
}

// A field value is plain text/number, a single selected option (radio/dropdown), a list of
// selected options (a checkbox group), a list of per-row values maps for a "group" field (one
// per duplicated row), or a list of markings for an "image" field.
export type MedicalFormFieldValue = string | string[] | MedicalFormValues[] | ImageMarking[] | null;
export type MedicalFormValues = Record<string, MedicalFormFieldValue>;

// Mirrors the per-field half of SavedMedicalFormController.SumFieldScores on the frontend, so
// a field can be highlighted as abnormal live while filling/viewing it - not just after a
// save round-trips through the server. Returns null when the field isn't a scorable type/kind
// of value at all (nothing to compare against a range), as opposed to 0.
export function computeFieldContribution(field: MedicalFormField, value: MedicalFormFieldValue): number | null {
  if (!field.scoring?.enabled) return null;
  const options = field.scoring.options;

  if (options.length > 0) {
    const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : typeof value === "string" ? [value] : [];
    if (selected.length === 0) return null;
    let total = 0;
    let matched = false;
    for (const s of selected) {
      const match = options.find((o) => o.value === s);
      if (match?.score !== undefined) {
        total += match.score;
        matched = true;
      }
    }
    return matched ? total : null;
  }

  if (typeof value !== "string" || value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

// A field is only flagged once it actually has a contribution AND at least one limit is set -
// an unfilled field, or a scored field with no lowerLimit/upperLimit configured at all, is
// never treated as abnormal.
export function isFieldAbnormal(field: MedicalFormField, value: MedicalFormFieldValue): boolean {
  const { lowerLimit, upperLimit } = field.scoring ?? {};
  if (lowerLimit === undefined && upperLimit === undefined) return false;
  const contribution = computeFieldContribution(field, value);
  if (contribution === null) return false;
  return (lowerLimit !== undefined && contribution < lowerLimit) || (upperLimit !== undefined && contribution > upperLimit);
}

export interface FormTemplateType {
  formTemplateId: string;
  name: string;
  fieldsJson: string; // JSON-serialized MedicalFormRow[]
  supportsHandover: boolean;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  departmentIds: string[];
  specializationIds: string[];
}

export interface AvailableFormTemplatesType {
  mostUsed: FormTemplateType[];
  allForms: FormTemplateType[];
}

export interface SavedMedicalFormType {
  savedMedicalFormId: string;
  patientId: string;
  visitId: string;
  formTemplateId: string;
  formTemplateName: string;
  fieldsJson: string; // JSON-serialized MedicalFormRow[] (a snapshot at save time)
  valuesJson: string;
  totalScore: number | null;
  // Server-computed (never trust a client self-report): true if any scored field's value
  // fell outside its own configured lower/upper limit at save time - lets the saved-forms
  // list flag a "critical" entry without needing to re-parse and re-walk its whole field
  // tree just to find out.
  hasAbnormalValue: boolean;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  canEdit: boolean;
  supportsHandover: boolean;
  handoverStatus: "None" | "Pending" | "Completed";
  handoverToUserId: string | null;
  handoverToName: string | null;
  handoverFromUserId: string | null;
}

export interface PendingFormHandoverType {
  savedMedicalFormId: string;
  formTemplateName: string;
  patientName: string | null;
  fromUserName: string | null;
  createdAt: string;
}
