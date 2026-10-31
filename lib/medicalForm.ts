import { parseDateInputValue, toDateInputValue } from "@/lib/date";
import {
  FormPlaceholderType,
  MedicalFormField,
  MedicalFormFieldValue,
  MedicalFormRow,
  MedicalFormValues,
} from "@/types/medicalForm.type";

// The placeholders a form can use plus, when there's a patient, what they resolve to. `values`
// null means there's no patient (the builder's preview) - tokens then show as their labels.
export interface PlaceholderContext {
  catalog: FormPlaceholderType[];
  values: Record<string, string> | null;
}

const TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;
const SINGLE_TOKEN = /^\{\{\s*([\w.]+)\s*\}\}$/;

export const placeholderToken = (key: string) => `{{${key}}}`;
export const hasPlaceholders = (text: string) => /\{\{\s*[\w.]+\s*\}\}/.test(text);

// Designer text cut into plain runs and {{key}} tokens, in order - a token's `text` is the raw token.
export function splitPlaceholders(text: string): { text: string; key?: string }[] {
  const parts: { text: string; key?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: match[0], key: match[1] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// How a resolved value reads on screen or paper - dates in the viewer's own locale.
export function formatPlaceholderValue(type: FormPlaceholderType["type"], raw: string): string {
  if (!raw || (type !== "date" && type !== "datetime")) return raw;
  const date = raw.includes("T") ? new Date(raw) : parseDateInputValue(raw);
  if (!date || Number.isNaN(date.getTime())) return raw;
  return type === "date" ? date.toLocaleDateString() : date.toLocaleString();
}

// Text with every known token replaced by the patient's data, or by ‹label› in the preview.
// Unknown keys are left exactly as typed.
export function fillPlaceholders(text: string, ctx: PlaceholderContext): string {
  return text.replace(TOKEN, (token, key: string) => {
    const def = ctx.catalog.find((p) => p.key === key);
    if (!def) return token;
    return ctx.values ? formatPlaceholderValue(def.type, ctx.values[key] ?? "") : `‹${def.label}›`;
  });
}

const DEFAULT_VALUE_TYPES = new Set(["text", "textarea", "number", "date", "datetime"]);

// What a date / datetime-local input expects, from a yyyy-MM-dd date or an ISO timestamp.
function toInputDate(type: "date" | "datetime", raw: string): string {
  const date = raw.includes("T") ? new Date(raw) : parseDateInputValue(raw);
  if (!date || Number.isNaN(date.getTime())) return "";
  if (type === "date") return toDateInputValue(date);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${toDateInputValue(date)}T${time}`;
}

// A field's starting value when the form opens - its defaultValue with placeholders filled.
// A date/datetime field takes one date placeholder (or a typed date) in the input's own format.
export function resolveDefaultValue(field: MedicalFormField, ctx: PlaceholderContext): string {
  const template = field.defaultValue?.trim();
  if (!template || !DEFAULT_VALUE_TYPES.has(field.type)) return "";

  if (field.type === "date" || field.type === "datetime") {
    const single = SINGLE_TOKEN.exec(template);
    if (!single) return toInputDate(field.type, template);
    return ctx.values ? toInputDate(field.type, ctx.values[single[1]] ?? "") : "";
  }
  // A number input can't show a ‹label› chip, so the preview leaves it empty instead.
  if (field.type === "number" && !ctx.values && hasPlaceholders(template)) return "";
  return fillPlaceholders(template, ctx);
}

// Each copy of a repeatable row or section carries its own stable key, so removing one from
// the middle doesn't hand a neighbour's signature or drawing to the wrong copy.
export const COPY_KEY = "__key";
let copySeq = 0;
export const newCopyKey = () => `copy-${Date.now().toString(36)}-${(copySeq++).toString(36)}`;

export function copiesOf(value: MedicalFormFieldValue | undefined): MedicalFormValues[] {
  return Array.isArray(value)
    ? value.filter((v): v is MedicalFormValues => typeof v === "object" && v !== null && !Array.isArray(v))
    : [];
}

// Starting values for one set of fields - defaults filled in, and one copy of every repeatable
// section among them.
function startingValues(fields: MedicalFormField[], ctx: PlaceholderContext): MedicalFormValues {
  const values: MedicalFormValues = {};
  for (const field of fields) {
    if (field.type === "group") {
      values[field.id] = [newCopy(field.childFields ?? [], ctx)];
      continue;
    }
    const initial = resolveDefaultValue(field, ctx);
    if (initial) values[field.id] = field.repeatable ? [initial] : initial;
  }
  return values;
}

// A new copy of a repeatable row or section: the same fields with fresh starting values.
export function newCopy(fields: MedicalFormField[], ctx: PlaceholderContext): MedicalFormValues {
  return { ...startingValues(fields, ctx), [COPY_KEY]: newCopyKey() };
}

// What a brand-new fill starts with - defaults and placeholders filled in, and one copy of
// every repeatable row and section already in place.
export function buildInitialValues(rows: MedicalFormRow[], ctx: PlaceholderContext): MedicalFormValues {
  const values: MedicalFormValues = {};
  for (const row of rows) {
    if (row.repeatable) values[row.id] = [newCopy(row.fields, ctx)];
    else Object.assign(values, startingValues(row.fields, ctx));
  }
  return values;
}

const NEVER_REQUIRED = new Set(["heading", "subheading", "paragraph", "group"]);
const REPEATABLE_FIELD_TYPES = new Set(["text", "textarea", "number", "date", "datetime", "dropdown"]);

export function isMissingRequired(field: MedicalFormField, value: MedicalFormFieldValue): boolean {
  if (!field.required || field.readOnly || NEVER_REQUIRED.has(field.type)) return false;
  if (field.repeatable && REPEATABLE_FIELD_TYPES.has(field.type)) {
    const entries = Array.isArray(value) ? value : [];
    return entries.length === 0 || entries.some((e) => typeof e !== "string" || e.trim() === "");
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return value === null || value === undefined;
}

// Required answers still empty - checked in every copy of a repeatable row or section, the
// same way they're shown while filling (an untouched one shows as a single blank copy).
export function countMissingRequired(rows: MedicalFormRow[], values: MedicalFormValues): number {
  const countIn = (fields: MedicalFormField[], vals: MedicalFormValues): number =>
    fields.reduce((sum, field) => {
      if (field.type === "group") {
        const copies = copiesOf(vals[field.id]);
        return sum + (copies.length ? copies : [{}]).reduce((s, copy) => s + countIn(field.childFields ?? [], copy), 0);
      }
      return sum + (isMissingRequired(field, vals[field.id] ?? null) ? 1 : 0);
    }, 0);

  return rows.reduce((sum, row) => {
    if (!row.repeatable) return sum + countIn(row.fields, values);
    const copies = copiesOf(values[row.id]);
    return sum + (copies.length ? copies : [{}]).reduce((s, copy) => s + countIn(row.fields, copy), 0);
  }, 0);
}
