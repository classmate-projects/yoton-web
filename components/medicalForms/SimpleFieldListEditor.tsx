"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  Circle,
  Copy,
  Heading1,
  Heading2,
  Hash,
  Image as ImageIcon,
  Pilcrow,
  PenLine,
  Trash2,
  Type,
} from "lucide-react";
import { DEFAULT_FORMATTING, MedicalFormField, MedicalFormFieldType } from "@/types/medicalForm.type";
import FieldEditorPanel from "./FieldEditorPanel";

// Same field palette as the main builder, minus "group" - a repeatable section can't contain
// another one (see FormBuilderCanvas), so this editor (used only for a group's own
// childFields) never offers it in the first place.
const FIELD_PALETTE: { type: MedicalFormFieldType; label: string; icon: typeof Type }[] = [
  { type: "heading", label: "Heading", icon: Heading1 },
  { type: "subheading", label: "Subheading", icon: Heading2 },
  { type: "paragraph", label: "Paragraph", icon: Pilcrow },
  { type: "text", label: "Text input", icon: Type },
  { type: "textarea", label: "Text area", icon: Copy },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "radio", label: "Radio button", icon: Circle },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "datetime", label: "Date & time", icon: CalendarClock },
  { type: "image", label: "Image / diagram", icon: ImageIcon },
  { type: "signature", label: "Signature", icon: PenLine },
];

let uid = 0;
const nextFieldId = () => `fld-${Date.now().toString(36)}-${(uid++).toString(36)}`;

function createDefaultField(type: MedicalFormFieldType): MedicalFormField {
  const base: MedicalFormField = {
    id: nextFieldId(),
    type,
    label: FIELD_PALETTE.find((f) => f.type === type)?.label ?? "Field",
    required: false,
    formatting: { ...DEFAULT_FORMATTING },
  };
  if (type === "heading") base.headingLevel = "h2";
  if (["checkbox", "radio", "dropdown"].includes(type)) base.options = ["Option 1", "Option 2"];
  return base;
}

// A repeatable section's own row template - click-to-add + up/down reordering rather than the
// main canvas's drag-and-drop/columns, since a group's row is typically small (a handful of
// fields) and doesn't need its own nested row/column layout.
export default function SimpleFieldListEditor({
  fields,
  onChange,
}: {
  fields: MedicalFormField[];
  onChange: (fields: MedicalFormField[]) => void;
}) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const addField = (type: MedicalFormFieldType) => {
    const field = createDefaultField(type);
    onChange([...fields, field]);
    setSelectedFieldId(field.id);
  };

  const updateField = (updated: MedicalFormField) => {
    onChange(fields.map((f) => (f.id === updated.id ? updated : f)));
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const moveField = (id: string, direction: -1 | 1) => {
    const index = fields.findIndex((f) => f.id === id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= fields.length) return;

    const reordered = [...fields];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    onChange(reordered);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FIELD_PALETTE.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => addField(type)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Add fields from the palette above.
          </p>
        )}
        {fields.map((field, index) => {
          const isSelected = selectedFieldId === field.id;
          return (
            <div key={field.id} className="rounded-lg border border-border">
              <div
                onClick={() => setSelectedFieldId(isSelected ? null : field.id)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-2.5 ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{field.label || "(untitled)"}</p>
                  <p className="text-xs text-muted-foreground">{FIELD_PALETTE.find((f) => f.type === field.type)?.label}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => moveField(field.id, -1)}
                    disabled={index === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(field.id, 1)}
                    disabled={index === fields.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {isSelected && (
                <div className="border-t border-border p-3">
                  <FieldEditorPanel field={field} onChange={updateField} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
