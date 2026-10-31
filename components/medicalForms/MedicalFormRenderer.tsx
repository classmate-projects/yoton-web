"use client";

import { createContext, Fragment, useContext, useId, type ReactNode } from "react";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import {
  DEFAULT_FORMATTING,
  ImageMarking,
  isFieldAbnormal,
  MedicalFormField,
  MedicalFormFieldValue,
  MedicalFormRow,
  MedicalFormValues,
} from "@/types/medicalForm.type";
import {
  COPY_KEY,
  copiesOf,
  formatPlaceholderValue,
  isMissingRequired,
  newCopy,
  newCopyKey,
  PlaceholderContext,
  splitPlaceholders,
} from "@/lib/medicalForm";
import ImageAnnotationCanvas from "./ImageAnnotationCanvas";
import SignaturePad from "./SignaturePad";

interface MedicalFormRendererProps {
  rows: MedicalFormRow[];
  // "fill": filling the form in (inputs enabled, onChange required) - also the builder's
  // try-it-out preview. "view": read-only - a saved form someone other than its creator is
  // looking at, or a printout.
  mode: "fill" | "view";
  values: MedicalFormValues;
  // Keyed by field id - or, for a repeatable row, by the row's own id with its full list of copies.
  onChange?: (key: string, value: MedicalFormFieldValue) => void;
  // Present only for the builder's own live preview - lets an "image" field's diagram be
  // dragged to a display size that's then saved as part of the template, rather than a
  // per-fill value. Never passed for the end-user fill view or a saved form's read-only view.
  onFieldConfigChange?: (fieldId: string, patch: Partial<MedicalFormField>) => void;
  // Resolves {{placeholder}} tokens in labels and text - without it they show as typed.
  placeholders?: PlaceholderContext;
  // Set once a save was attempted with required answers missing - each one is outlined in red.
  showErrors?: boolean;
}

interface RenderSettings {
  placeholders: PlaceholderContext;
  showErrors: boolean;
}

const NO_PLACEHOLDERS: PlaceholderContext = { catalog: [], values: null };
const RenderSettingsContext = createContext<RenderSettings>({ placeholders: NO_PLACEHOLDERS, showErrors: false });

// Top-level render engine, reused by three places: the builder's live preview, the end-user
// fill view, and the read-only saved-form view/printout. Each row renders as its own CSS grid
// so its fields sit side by side as columns - row/column position is just array position (no
// separate `order` field to keep in sync after a drag-and-drop move, see FormBuilderCanvas).
export default function MedicalFormRenderer({
  rows,
  mode,
  values,
  onChange,
  onFieldConfigChange,
  placeholders,
  showErrors = false,
}: MedicalFormRendererProps) {
  return (
    <RenderSettingsContext.Provider value={{ placeholders: placeholders ?? NO_PLACEHOLDERS, showErrors }}>
      <div className="flex flex-col gap-4">
        {rows.map((row) =>
          row.repeatable ? (
            <RepeatedCopies
              key={row.id}
              fields={row.fields}
              value={values[row.id] ?? null}
              mode={mode}
              max={row.maxRepeats}
              controlsClassName="self-center"
              onChange={(copies) => onChange?.(row.id, copies)}
              renderCopy={(copy, update) => (
                <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
                  <FieldGrid fields={row.fields} mode={mode} values={copy} onChange={update} onFieldConfigChange={onFieldConfigChange} />
                </div>
              )}
            />
          ) : (
            <FieldGrid
              key={row.id}
              fields={row.fields}
              mode={mode}
              values={values}
              onChange={(fieldId, value) => onChange?.(fieldId, value)}
              onFieldConfigChange={onFieldConfigChange}
            />
          )
        )}
      </div>
    </RenderSettingsContext.Provider>
  );
}

function FieldGrid({
  fields,
  mode,
  values,
  onChange,
  onFieldConfigChange,
}: {
  fields: MedicalFormField[];
  mode: "fill" | "view";
  values: MedicalFormValues;
  onChange: (fieldId: string, value: MedicalFormFieldValue) => void;
  onFieldConfigChange?: (fieldId: string, patch: Partial<MedicalFormField>) => void;
}) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }}>
      {fields.map((field) => (
        <FieldBlock
          key={field.id}
          field={field}
          mode={mode}
          value={values[field.id] ?? null}
          onChange={(value) => onChange(field.id, value)}
          onFieldConfigChange={onFieldConfigChange}
        />
      ))}
    </div>
  );
}

// The flat-list variant, for a "group" field's own childFields - a repeatable section's per-
// copy template is small enough that it stays a single column (no nested row/column layout).
function FieldList({
  fields,
  mode,
  values,
  onChange,
}: {
  fields: MedicalFormField[];
  mode: "fill" | "view";
  values: MedicalFormValues;
  onChange: (fieldId: string, value: MedicalFormFieldValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <FieldBlock key={field.id} field={field} mode={mode} value={values[field.id] ?? null} onChange={(value) => onChange(field.id, value)} />
      ))}
    </div>
  );
}

const copyKeyOf = (copy: MedicalFormValues, index: number): string => {
  const key = copy[COPY_KEY];
  return typeof key === "string" ? key : `index-${index}`;
};

// Copies of a repeatable row or section: + adds a fresh copy right below, − removes that one,
// and the last copy can never be removed. Something untouched (or saved before it had copies)
// still shows one blank copy to fill in; read-only with none saved shows "None recorded".
function RepeatedCopies({
  fields,
  value,
  mode,
  max,
  controlsClassName,
  onChange,
  renderCopy,
}: {
  fields: MedicalFormField[];
  value: MedicalFormFieldValue;
  mode: "fill" | "view";
  max?: number;
  controlsClassName?: string;
  onChange: (copies: MedicalFormValues[]) => void;
  renderCopy: (copy: MedicalFormValues, update: (fieldId: string, value: MedicalFormFieldValue) => void, index: number) => ReactNode;
}) {
  const { placeholders } = useContext(RenderSettingsContext);
  const stored = copiesOf(value);
  const copies: MedicalFormValues[] = stored.length > 0 ? stored : mode === "fill" ? [{ [COPY_KEY]: "first" }] : [];
  if (copies.length === 0) return <p className="text-sm text-muted-foreground">None recorded.</p>;

  const canAdd = !max || copies.length < max;
  // Copies saved before they had keys get one the first time the list changes.
  const commit = (next: MedicalFormValues[]) =>
    onChange(next.map((copy) => (typeof copy[COPY_KEY] === "string" ? copy : { ...copy, [COPY_KEY]: newCopyKey() })));

  return (
    <div className="flex flex-col gap-2">
      {copies.map((copy, index) => (
        <div key={copyKeyOf(copy, index)} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {renderCopy(
              copy,
              (fieldId, fieldValue) => commit(copies.map((c, i) => (i === index ? { ...c, [fieldId]: fieldValue } : c))),
              index
            )}
          </div>
          {mode === "fill" && (
            <CopyButtons
              className={controlsClassName}
              canAdd={canAdd}
              canRemove={copies.length > 1}
              onAdd={() => commit([...copies.slice(0, index + 1), newCopy(fields, placeholders), ...copies.slice(index + 1)])}
              onRemove={() => commit(copies.filter((_, i) => i !== index))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// A single field the designer made repeatable - each entry is its own input with the same
// + / − controls as a repeated row, and at least one entry always stays.
function RepeatedEntries({
  value,
  disabled,
  onChange,
  render,
}: {
  value: MedicalFormFieldValue;
  disabled: boolean;
  onChange: (entries: string[]) => void;
  render: (entry: string, set: (entry: string) => void) => ReactNode;
}) {
  const entries = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  const items = entries.length === 0 ? [""] : entries;
  return (
    <div className="flex flex-col gap-2">
      {items.map((entry, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{render(entry, (next) => onChange(items.map((e, idx) => (idx === i ? next : e))))}</div>
          {!disabled && (
            <CopyButtons
              className="mt-1.5"
              canAdd
              canRemove={items.length > 1}
              onAdd={() => onChange([...items.slice(0, i + 1), "", ...items.slice(i + 1)])}
              onRemove={() => onChange(items.filter((_, idx) => idx !== i))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CopyButtons({
  canAdd,
  canRemove,
  onAdd,
  onRemove,
  className = "",
}: {
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
  className?: string;
}) {
  const base =
    "flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
        title={canAdd ? "Add another" : "Maximum reached"}
        aria-label="Add another"
        className={`${base} enabled:hover:border-primary enabled:hover:text-primary`}
      >
        <Plus size={15} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title={canRemove ? "Remove this one" : "At least one is needed"}
        aria-label="Remove this one"
        className={`${base} enabled:hover:border-red-300 enabled:hover:text-red-600`}
      >
        <Minus size={15} />
      </button>
    </div>
  );
}

const alignClass = (align: MedicalFormField["formatting"]["align"]) =>
  align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

function formattingStyle(formatting: MedicalFormField["formatting"]): React.CSSProperties {
  return {
    // Only emit an inline color when the admin actually picked one - otherwise this would
    // override the theme-aware `text-foreground`/`text-muted-foreground` classes every case
    // below already carries, which is exactly what made heading/subheading/paragraph text
    // (styled directly on the element, not through a separately-colored child span like
    // FieldLabel used to be) unreadable in dark mode: the untouched default (#1f2937, a
    // light-mode dark gray) was winning over the theme class on every render, customized or not.
    color: formatting.color === DEFAULT_FORMATTING.color ? undefined : formatting.color,
    backgroundColor: formatting.backgroundColor === "transparent" ? undefined : formatting.backgroundColor,
    borderRadius: formatting.backgroundColor === "transparent" ? undefined : 8,
    fontWeight: formatting.bold ? 700 : undefined,
    fontStyle: formatting.italic ? "italic" : undefined,
    textDecoration: formatting.underline ? "underline" : undefined,
    marginTop: formatting.marginTop,
    marginBottom: formatting.marginBottom,
    paddingLeft: formatting.paddingX,
    paddingRight: formatting.paddingX,
    paddingTop: formatting.paddingY,
    paddingBottom: formatting.paddingY,
  };
}

function FieldBlock({
  field,
  mode,
  value,
  onChange,
  onFieldConfigChange,
}: {
  field: MedicalFormField;
  mode: "fill" | "view";
  value: MedicalFormFieldValue;
  onChange: (value: MedicalFormFieldValue) => void;
  onFieldConfigChange?: (fieldId: string, patch: Partial<MedicalFormField>) => void;
}) {
  const { showErrors } = useContext(RenderSettingsContext);
  // Radios group by name, and every copy of a repeated row renders the same field id - each
  // FieldBlock gets its own name so picking an option in one copy can't clear another's.
  const radioName = useId();
  const style = formattingStyle(field.formatting);
  const className = `${field.formatting.fontSize} ${alignClass(field.formatting.align)}`;
  const disabled = mode === "view" || !!field.readOnly;
  const inputClass = `disabled:cursor-default disabled:opacity-100 disabled:bg-muted/40 ${className}`;
  // Live in both modes on purpose - immediate feedback while filling, and just as visible
  // when reviewing an already-saved form later (spec: "help in reviewing").
  const abnormal = isFieldAbnormal(field, value);
  const missing = showErrors && mode === "fill" && isMissingRequired(field, value);
  // Always reserve the same border/padding box, whether or not the field is currently flagged
  // (abnormal, or a required answer still missing) - only its color changes. Otherwise the one
  // flagged field would suddenly grow a 2px border + 8px padding while its row-siblings didn't,
  // visibly shifting it out of line mid-typing.
  const boxClass = `rounded-lg border-2 p-2 transition-colors ${
    missing ? "border-red-400" : abnormal ? "border-red-400 bg-red-500/10" : "border-transparent"
  }`;
  // A single input is wrapped in its <label> (click-to-focus); repeated entries can't share one.
  const Wrapper = field.repeatable ? "div" : "label";

  switch (field.type) {
    case "heading": {
      const Tag = field.headingLevel ?? "h2";
      const sizeClass = Tag === "h1" ? "text-3xl font-bold" : Tag === "h3" ? "text-lg font-semibold" : "text-2xl font-semibold";
      return (
        <Tag style={style} className={`${sizeClass} ${alignClass(field.formatting.align)} text-foreground`}>
          <PlaceholderText text={field.label} />
        </Tag>
      );
    }
    case "subheading":
      return (
        <h4 style={style} className={`text-base font-semibold text-foreground ${alignClass(field.formatting.align)}`}>
          <PlaceholderText text={field.label} />
        </h4>
      );
    case "paragraph":
      return (
        <p style={style} className={`${className} whitespace-pre-line text-muted-foreground`}>
          <PlaceholderText text={field.label} />
        </p>
      );

    case "text":
    case "number":
    case "date":
    case "datetime": {
      const inputType = field.type === "datetime" ? "datetime-local" : field.type;
      const input = (entry: string, set: (entry: string) => void) => (
        <input
          type={inputType}
          disabled={disabled}
          required={field.required}
          placeholder={field.placeholder}
          value={entry}
          onChange={(e) => set(e.target.value)}
          className={`h-11 w-full text-base ${inputClass}`}
        />
      );
      return (
        <Wrapper style={style} className={`flex flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} abnormal={abnormal} missing={missing} />
          {field.repeatable ? (
            <RepeatedEntries value={value} disabled={disabled} onChange={onChange} render={input} />
          ) : (
            input(typeof value === "string" ? value : "", onChange)
          )}
        </Wrapper>
      );
    }

    case "textarea": {
      const input = (entry: string, set: (entry: string) => void) => (
        <textarea
          disabled={disabled}
          required={field.required}
          placeholder={field.placeholder}
          rows={field.repeatable ? 3 : 4}
          value={entry}
          onChange={(e) => set(e.target.value)}
          className={`w-full text-base ${inputClass}`}
        />
      );
      return (
        <Wrapper style={style} className={`flex flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} abnormal={abnormal} missing={missing} />
          {field.repeatable ? (
            <RepeatedEntries value={value} disabled={disabled} onChange={onChange} render={input} />
          ) : (
            input(typeof value === "string" ? value : "", onChange)
          )}
        </Wrapper>
      );
    }

    case "dropdown": {
      const input = (entry: string, set: (entry: string) => void) => (
        <select
          disabled={disabled}
          required={field.required}
          value={entry}
          onChange={(e) => set(e.target.value)}
          className={`h-11 w-full text-base ${inputClass}`}
        >
          <option value="">Select...</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      return (
        <Wrapper style={style} className={`flex flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} abnormal={abnormal} missing={missing} />
          {field.repeatable ? (
            <RepeatedEntries value={value} disabled={disabled} onChange={onChange} render={input} />
          ) : (
            input(typeof value === "string" ? value : "", onChange)
          )}
        </Wrapper>
      );
    }

    case "radio":
      return (
        <div role="group" style={style} className={`flex min-w-0 flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} abnormal={abnormal} missing={missing} />
          <div className="flex flex-col gap-2">
            {(field.options ?? []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={radioName}
                  disabled={disabled}
                  required={field.required}
                  checked={value === option}
                  onChange={() => onChange(option)}
                  className="h-4 w-4"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      );

    case "checkbox": {
      const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
      const toggle = (option: string) => {
        const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
        onChange(next);
      };
      return (
        <div role="group" style={style} className={`flex min-w-0 flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} abnormal={abnormal} missing={missing} />
          <div className="flex flex-col gap-2">
            {(field.options ?? []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected.includes(option)}
                  onChange={() => toggle(option)}
                  className="h-4 w-4"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      );
    }

    // Repeatable section - value is an array of per-copy values maps, each copy rendering the
    // same childFields template as a flat list.
    case "group": {
      const childFields = field.childFields ?? [];
      return (
        <div role="group" style={style} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
          <FieldLabel field={field} />
          <RepeatedCopies
            fields={childFields}
            value={value}
            mode={mode}
            max={field.maxDuplicates}
            onChange={onChange}
            renderCopy={(copy, update, index) => (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                <FieldList fields={childFields} mode={mode} values={copy} onChange={update} />
              </div>
            )}
          />
        </div>
      );
    }

    case "image": {
      const markings = Array.isArray(value)
        ? value.filter((v): v is ImageMarking => typeof v === "object" && v !== null && !Array.isArray(v) && "type" in v)
        : [];
      return (
        <div style={style} className={`flex flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} missing={missing} />
          <ImageAnnotationCanvas
            imagePath={field.imagePath}
            value={markings}
            mode={mode}
            onChange={(next) => onChange(next)}
            width={field.imageWidth}
            onResizeWidth={
              onFieldConfigChange ? (imageWidth) => onFieldConfigChange(field.id, { imageWidth }) : undefined
            }
          />
        </div>
      );
    }

    case "signature":
      return (
        <div style={style} className={`flex flex-col gap-1.5 ${boxClass}`}>
          <FieldLabel field={field} missing={missing} />
          <SignaturePad value={typeof value === "string" ? value : null} mode={mode} onChange={(dataUrl) => onChange(dataUrl)} />
        </div>
      );

    default:
      return null;
  }
}

// Designer text with {{key}} tokens: the patient's data while filling or viewing, a labelled
// chip in the builder's preview, and exactly as typed when the key isn't a known placeholder.
function PlaceholderText({ text }: { text: string }) {
  const { placeholders } = useContext(RenderSettingsContext);
  return (
    <>
      {splitPlaceholders(text).map((part, i) => {
        const def = part.key ? placeholders.catalog.find((p) => p.key === part.key) : undefined;
        if (!def) return <Fragment key={i}>{part.text}</Fragment>;
        if (!placeholders.values) {
          return (
            <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
              {def.label}
            </span>
          );
        }
        return <Fragment key={i}>{formatPlaceholderValue(def.type, placeholders.values[def.key] ?? "") || "—"}</Fragment>;
      })}
    </>
  );
}

function FieldLabel({ field, abnormal = false, missing = false }: { field: MedicalFormField; abnormal?: boolean; missing?: boolean }) {
  // Only overrides the theme-aware default when the admin actually picked a color - same
  // "don't fight dark mode" rule formattingStyle applies to the field's own text/background;
  // this label used to hardcode its own color regardless of that setting.
  const color = field.formatting.color === DEFAULT_FORMATTING.color ? undefined : field.formatting.color;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground/90" style={{ color }}>
      <span>
        <PlaceholderText text={field.label} />
        {field.required && !field.readOnly && <span className="text-red-500"> *</span>}
      </span>
      {missing && <span className="text-xs font-semibold text-red-600">Required</span>}
      {abnormal && (
        <span title="Outside the normal range" className="flex items-center gap-1 text-xs font-semibold text-red-600">
          <AlertTriangle size={13} /> Abnormal
        </span>
      )}
    </span>
  );
}
