"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_FORMATTING,
  ImageMarking,
  isFieldAbnormal,
  MedicalFormField,
  MedicalFormFieldValue,
  MedicalFormRow,
  MedicalFormValues,
} from "@/types/medicalForm.type";
import ImageAnnotationCanvas from "./ImageAnnotationCanvas";
import SignaturePad from "./SignaturePad";

interface MedicalFormRendererProps {
  rows: MedicalFormRow[];
  // "fill": end-user filling the form (inputs enabled, onChange required).
  // "view": read-only, either the builder's live preview or an already-saved form someone
  // other than the creator is looking at.
  mode: "fill" | "view";
  values: MedicalFormValues;
  onChange?: (fieldId: string, value: MedicalFormFieldValue) => void;
}

// Top-level render engine, reused by three places: the builder's live preview, the end-user
// fill view, and the read-only saved-form view. Each row renders as its own CSS grid so its
// fields sit side by side as columns - row/column position is just array position (no
// separate `order` field to keep in sync after a drag-and-drop move, see FormBuilderCanvas).
export default function MedicalFormRenderer({ rows, mode, values, onChange }: MedicalFormRendererProps) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${row.fields.length}, minmax(0, 1fr))` }}>
          {row.fields.map((field) => (
            <FieldBlock
              key={field.id}
              field={field}
              mode={mode}
              value={values[field.id] ?? null}
              onChange={(value) => onChange?.(field.id, value)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// The flat-list variant, for a "group" field's own childFields - a repeatable section's per-
// row template is small enough that it stays a single column (no nested row/column layout).
export function MedicalFormFieldsRenderer({
  fields,
  mode,
  values,
  onChange,
}: {
  fields: MedicalFormField[];
  mode: "fill" | "view";
  values: MedicalFormValues;
  onChange?: (fieldId: string, value: MedicalFormFieldValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <FieldBlock
          key={field.id}
          field={field}
          mode={mode}
          value={values[field.id] ?? null}
          onChange={(value) => onChange?.(field.id, value)}
        />
      ))}
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
}: {
  field: MedicalFormField;
  mode: "fill" | "view";
  value: MedicalFormFieldValue;
  onChange: (value: MedicalFormFieldValue) => void;
}) {
  const style = formattingStyle(field.formatting);
  const className = `${field.formatting.fontSize} ${alignClass(field.formatting.align)}`;
  const disabled = mode === "view";
  // Live in both modes on purpose - immediate feedback while filling, and just as visible
  // when reviewing an already-saved form later (spec: "help in reviewing").
  const abnormal = isFieldAbnormal(field, value);
  // Always reserve the same border/padding box, whether or not the field is currently
  // abnormal - only its color changes. Previously this box only existed once a typed value
  // crossed into its abnormal range, which made that one field suddenly grow a 2px border +
  // 8px padding mid-typing while its row-siblings didn't - visibly shifting/misaligning it
  // relative to the rest of the row at exactly the moment someone was filling the form in.
  const abnormalClass = `rounded-lg border-2 p-2 transition-colors ${abnormal ? "border-red-400 bg-red-500/10" : "border-transparent"}`;

  switch (field.type) {
    case "heading": {
      const Tag = field.headingLevel ?? "h2";
      const sizeClass = Tag === "h1" ? "text-3xl font-bold" : Tag === "h3" ? "text-lg font-semibold" : "text-2xl font-semibold";
      return (
        <Tag style={style} className={`${sizeClass} ${alignClass(field.formatting.align)} text-foreground`}>
          {field.label}
        </Tag>
      );
    }
    case "subheading":
      return (
        <h4 style={style} className={`text-base font-semibold text-foreground ${alignClass(field.formatting.align)}`}>
          {field.label}
        </h4>
      );
    case "paragraph":
      return (
        <p style={style} className={`${className} text-muted-foreground`}>
          {field.label}
        </p>
      );

    case "text":
    case "number":
    case "date":
    case "datetime": {
      const inputType = field.type === "datetime" ? "datetime-local" : field.type;
      return (
        <label style={style} className={`flex flex-col gap-1.5 ${abnormalClass}`}>
          <FieldLabel field={field} abnormal={abnormal} />
          <input
            type={inputType}
            disabled={disabled}
            required={field.required}
            placeholder={field.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-11 w-full text-base disabled:cursor-default disabled:opacity-100 disabled:bg-muted/40 ${className}`}
          />
        </label>
      );
    }

    case "textarea":
      return (
        <label style={style} className={`flex flex-col gap-1.5 ${abnormalClass}`}>
          <FieldLabel field={field} abnormal={abnormal} />
          <textarea
            disabled={disabled}
            required={field.required}
            placeholder={field.placeholder}
            rows={4}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full text-base disabled:cursor-default disabled:opacity-100 disabled:bg-muted/40 ${className}`}
          />
        </label>
      );

    case "dropdown":
      return (
        <label style={style} className={`flex flex-col gap-1.5 ${abnormalClass}`}>
          <FieldLabel field={field} abnormal={abnormal} />
          <select
            disabled={disabled}
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className={`h-11 w-full text-base disabled:cursor-default disabled:opacity-100 disabled:bg-muted/40 ${className}`}
          >
            <option value="">Select...</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );

    case "radio":
      return (
        <fieldset style={style} className={`flex flex-col gap-1.5 ${abnormalClass}`}>
          <FieldLabel field={field} abnormal={abnormal} />
          <div className="flex flex-col gap-2">
            {(field.options ?? []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.id}
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
        </fieldset>
      );

    case "checkbox": {
      const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
      const toggle = (option: string) => {
        const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
        onChange(next);
      };
      return (
        <fieldset style={style} className={`flex flex-col gap-1.5 ${abnormalClass}`}>
          <FieldLabel field={field} abnormal={abnormal} />
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
        </fieldset>
      );
    }

    // Duplicatable section - value is an array of per-row values maps, each row rendering
    // the same childFields template via the flat MedicalFormFieldsRenderer.
    case "group": {
      const rows = Array.isArray(value)
        ? value.filter((v): v is MedicalFormValues => typeof v === "object" && v !== null && !Array.isArray(v))
        : [];
      const childFields = field.childFields ?? [];
      const canAddMore = !field.maxDuplicates || rows.length < field.maxDuplicates;

      const updateRow = (rowIndex: number, childId: string, childValue: MedicalFormFieldValue) => {
        onChange(rows.map((row, i) => (i === rowIndex ? { ...row, [childId]: childValue } : row)));
      };
      const addRow = () => onChange([...rows, {}]);
      const removeRow = (rowIndex: number) => onChange(rows.filter((_, i) => i !== rowIndex));

      return (
        <fieldset style={style} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <FieldLabel field={field} />
          {rows.length === 0 && disabled && <p className="text-sm text-muted-foreground">None recorded.</p>}
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">#{rowIndex + 1}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    title="Remove row"
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <MedicalFormFieldsRenderer
                fields={childFields}
                mode={mode}
                values={row}
                onChange={(childId, childValue) => updateRow(rowIndex, childId, childValue)}
              />
            </div>
          ))}
          {!disabled && canAddMore && (
            <button
              type="button"
              onClick={addRow}
              className="flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus size={14} /> Add row
            </button>
          )}
        </fieldset>
      );
    }

    case "image": {
      const markings = Array.isArray(value)
        ? value.filter((v): v is ImageMarking => typeof v === "object" && v !== null && !Array.isArray(v) && "type" in v)
        : [];
      return (
        <div style={style} className="flex flex-col gap-1.5">
          <FieldLabel field={field} />
          <ImageAnnotationCanvas imagePath={field.imagePath} value={markings} mode={mode} onChange={(next) => onChange(next)} />
        </div>
      );
    }

    case "signature":
      return (
        <div style={style} className="flex flex-col gap-1.5">
          <FieldLabel field={field} />
          <SignaturePad value={typeof value === "string" ? value : null} mode={mode} onChange={(dataUrl) => onChange(dataUrl)} />
        </div>
      );

    default:
      return null;
  }
}

function FieldLabel({ field, abnormal = false }: { field: MedicalFormField; abnormal?: boolean }) {
  // Only overrides the theme-aware default when the admin actually picked a color - same
  // "don't fight dark mode" rule formattingStyle applies to the field's own text/background;
  // this label used to hardcode its own color regardless of that setting.
  const color = field.formatting.color === DEFAULT_FORMATTING.color ? undefined : field.formatting.color;
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground/90" style={{ color }}>
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
      {abnormal && (
        <span title="Outside the normal range" className="flex items-center gap-1 text-xs font-semibold text-red-600">
          <AlertTriangle size={13} /> Abnormal
        </span>
      )}
    </span>
  );
}
