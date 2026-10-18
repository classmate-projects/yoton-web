"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, Upload, X } from "lucide-react";
import { backendAssetUrl } from "@/lib/backendAsset";
import { FormTemplateService } from "@/services/medicalForm.service";
import { usePlaceholderCatalog } from "@/hooks/usePlaceholderCatalog";
import { MedicalFormField, MedicalFormFieldOption } from "@/types/medicalForm.type";
import PlaceholderTextInput from "./PlaceholderTextInput";

const FONT_SIZES = [
  { value: "text-sm", label: "Small" },
  { value: "text-base", label: "Normal" },
  { value: "text-lg", label: "Large" },
  { value: "text-xl", label: "X-Large" },
  { value: "text-2xl", label: "XX-Large" },
];

const CHOICE_TYPES = new Set(["checkbox", "radio", "dropdown"]);
const SCORABLE_TYPES = new Set(["checkbox", "radio", "dropdown", "text", "number"]);
const REPEATABLE_TYPES = new Set(["text", "textarea", "number", "date", "datetime", "dropdown"]);
const TEXT_BLOCK_TYPES = new Set(["heading", "subheading", "paragraph"]);
const DEFAULT_VALUE_TYPES = new Set(["text", "textarea", "number", "date", "datetime"]);
const READ_ONLY_TYPES = new Set(["text", "textarea", "number", "date", "datetime", "dropdown", "radio", "checkbox"]);

const DEFAULT_VALUE_HINTS: Record<string, string> = {
  date: "Optional - a date (2026-01-31) or one from the patient's record. \"Date & time filled\" gives today.",
  datetime: "Optional - a date and time from the patient's record. \"Date & time filled\" gives now.",
  number: "Optional - a number, or one from the patient's record such as their latest weight.",
  text: "Optional - filled in when the form opens. Insert patient data to copy it from the patient's record.",
  textarea: "Optional - filled in when the form opens. Insert patient data to copy it from the patient's record.",
};

// Formatting + scoring controls for whichever field is currently selected on the builder
// canvas - every field type shares the same formatting block; options/scoring only render
// for the types that use them.
export default function FieldEditorPanel({
  field,
  onChange,
}: {
  field: MedicalFormField;
  onChange: (field: MedicalFormField) => void;
}) {
  const isChoiceType = CHOICE_TYPES.has(field.type);
  const isScorable = SCORABLE_TYPES.has(field.type);
  const options = field.options ?? [];
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const catalog = usePlaceholderCatalog();
  // A date input can only take a date, and a number input a number.
  const defaultValueCatalog =
    field.type === "date" || field.type === "datetime"
      ? catalog.filter((p) => p.type === "date" || p.type === "datetime")
      : field.type === "number"
        ? catalog.filter((p) => p.type === "number")
        : catalog;

  const uploadImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const data = await FormTemplateService.uploadImage(file);
      onChange({ ...field, imagePath: data.imagePath });
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const updateOption = (index: number, newValue: string) => {
    const oldValue = options[index];
    const nextOptions = options.map((o, i) => (i === index ? newValue : o));
    const nextScoringOptions = (field.scoring?.options ?? []).map((o) => (o.value === oldValue ? { ...o, value: newValue } : o));
    onChange({ ...field, options: nextOptions, scoring: field.scoring ? { ...field.scoring, options: nextScoringOptions } : field.scoring });
  };

  const addOption = () => {
    const label = `Option ${options.length + 1}`;
    onChange({ ...field, options: [...options, label] });
  };

  const removeOption = (index: number) => {
    const removed = options[index];
    const nextOptions = options.filter((_, i) => i !== index);
    const nextScoringOptions = (field.scoring?.options ?? []).filter((o) => o.value !== removed);
    onChange({ ...field, options: nextOptions, scoring: field.scoring ? { ...field.scoring, options: nextScoringOptions } : field.scoring });
  };

  const setScoreForOption = (optionValue: string, score: number | undefined) => {
    const existing = field.scoring?.options ?? [];
    const nextOptions: MedicalFormFieldOption[] = existing.some((o) => o.value === optionValue)
      ? existing.map((o) => (o.value === optionValue ? { ...o, score } : o))
      : [...existing, { value: optionValue, score }];
    onChange({ ...field, scoring: { enabled: field.scoring?.enabled ?? false, options: nextOptions } });
  };

  const toggleScoring = (enabled: boolean) => {
    onChange({ ...field, scoring: { options: [], ...field.scoring, enabled } });
  };

  const setLimit = (key: "lowerLimit" | "upperLimit", raw: string) => {
    if (!field.scoring) return;
    onChange({ ...field, scoring: { ...field.scoring, [key]: raw === "" ? undefined : Number(raw) } });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
      {/* ---------------- Label / placeholder / required ---------------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_BLOCK_TYPES.has(field.type) ? (
          <div className={`flex flex-col gap-1.5 ${field.type === "paragraph" ? "sm:col-span-2" : ""}`}>
            <span className="text-xs font-semibold text-muted-foreground">Text</span>
            <PlaceholderTextInput
              value={field.label}
              onChange={(label) => onChange({ ...field, label })}
              catalog={catalog}
              multiline={field.type === "paragraph"}
            />
          </div>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Label</span>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              className="h-9 text-sm"
            />
          </label>
        )}
        {["text", "textarea", "number", "date", "datetime"].includes(field.type) && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Placeholder</span>
            <input
              type="text"
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
              className="h-9 text-sm"
            />
          </label>
        )}
        {field.type === "heading" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Heading size</span>
            <select
              value={field.headingLevel ?? "h2"}
              onChange={(e) => onChange({ ...field, headingLevel: e.target.value as "h1" | "h2" | "h3" })}
              className="h-9 text-sm"
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
          </label>
        )}
        {field.type === "group" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Max duplicates (optional)</span>
            <input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={field.maxDuplicates ?? ""}
              onChange={(e) => onChange({ ...field, maxDuplicates: e.target.value === "" ? undefined : Number(e.target.value) })}
              className="h-9 text-sm"
            />
          </label>
        )}
      </div>

      {/* ---------------- Default value (with patient-data placeholders) ---------------- */}
      {DEFAULT_VALUE_TYPES.has(field.type) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Default value</span>
          <PlaceholderTextInput
            value={field.defaultValue ?? ""}
            onChange={(defaultValue) => onChange({ ...field, defaultValue: defaultValue || undefined })}
            catalog={defaultValueCatalog}
          />
          <p className="text-[11px] text-muted-foreground">{DEFAULT_VALUE_HINTS[field.type]}</p>
        </div>
      )}

      {/* ---------------- Image upload (type "image" only) ---------------- */}
      {field.type === "image" && (
        <div className="flex items-center gap-3">
          {field.imagePath && (
            /* eslint-disable-next-line @next/next/no-img-element -- small builder-time thumbnail of an admin-uploaded file, not eligible for next/image */
            <img src={backendAssetUrl(field.imagePath) ?? ""} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
          )}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
            <Upload size={14} /> {isUploadingImage ? "Uploading..." : field.imagePath ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploadingImage}
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {!["heading", "subheading", "paragraph", "group"].includes(field.type) && (
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
              className="h-4 w-4"
            />
            Required
          </label>
          {REPEATABLE_TYPES.has(field.type) && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.repeatable ?? false}
                onChange={(e) => onChange({ ...field, repeatable: e.target.checked })}
                className="h-4 w-4"
              />
              Repeatable
            </label>
          )}
          {READ_ONLY_TYPES.has(field.type) && (
            <label className="flex items-center gap-2 text-sm" title="Shown but can't be changed while filling - pair it with a default value">
              <input
                type="checkbox"
                checked={field.readOnly ?? false}
                onChange={(e) => onChange({ ...field, readOnly: e.target.checked || undefined })}
                className="h-4 w-4"
              />
              Read-only
            </label>
          )}
        </div>
      )}

      {/* ---------------- Choices (checkbox/radio/dropdown) ---------------- */}
      {isChoiceType && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Options</span>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="h-9 flex-1 text-sm"
              />
              {field.scoring?.enabled && (
                <input
                  type="number"
                  placeholder="Score"
                  value={field.scoring.options.find((o) => o.value === option)?.score ?? ""}
                  onChange={(e) => setScoreForOption(option, e.target.value === "" ? undefined : Number(e.target.value))}
                  className="h-9 w-20 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="h-9 rounded-md border border-border px-2 text-xs text-muted-foreground hover:border-red-300 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="w-fit rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
          >
            + Add option
          </button>
        </div>
      )}

      {/* ---------------- Scoring ---------------- */}
      {isScorable && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.scoring?.enabled ?? false}
              onChange={(e) => toggleScoring(e.target.checked)}
              className="h-4 w-4"
            />
            This field contributes to the form&apos;s score
          </label>
          {field.scoring?.enabled && !isChoiceType && (
            <p className="text-xs text-muted-foreground">The number entered here is added directly to the total score.</p>
          )}
          {field.scoring?.enabled && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Normal range <span className="font-normal">(optional - leave blank for no limit on that side)</span>
              </p>
              <div className="flex items-center gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Lower limit</span>
                  <input
                    type="number"
                    placeholder="No lower limit"
                    value={field.scoring.lowerLimit ?? ""}
                    onChange={(e) => setLimit("lowerLimit", e.target.value)}
                    className="h-9 text-sm"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Upper limit</span>
                  <input
                    type="number"
                    placeholder="No upper limit"
                    value={field.scoring.upperLimit ?? ""}
                    onChange={(e) => setLimit("upperLimit", e.target.value)}
                    className="h-9 text-sm"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A value inside this range is normal. Outside it, the field is highlighted as abnormal wherever this form is filled or reviewed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Formatting ---------------- */}
      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <span className="text-xs font-semibold text-muted-foreground">Formatting</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["left", "center", "right"] as const).map((align) => {
              const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
              return (
                <button
                  key={align}
                  type="button"
                  onClick={() => onChange({ ...field, formatting: { ...field.formatting, align } })}
                  className={`flex h-9 w-9 items-center justify-center ${field.formatting.align === align ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => onChange({ ...field, formatting: { ...field.formatting, bold: !field.formatting.bold } })}
              className={`flex h-9 w-9 items-center justify-center ${field.formatting.bold ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...field, formatting: { ...field.formatting, italic: !field.formatting.italic } })}
              className={`flex h-9 w-9 items-center justify-center ${field.formatting.italic ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...field, formatting: { ...field.formatting, underline: !field.formatting.underline } })}
              className={`flex h-9 w-9 items-center justify-center ${field.formatting.underline ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Underline size={15} />
            </button>
          </div>
          <select
            value={field.formatting.fontSize}
            onChange={(e) => onChange({ ...field, formatting: { ...field.formatting, fontSize: e.target.value } })}
            className="h-9 text-sm"
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1" title="Text color">
            <span className="text-[11px] text-muted-foreground">Text</span>
            <input
              type="color"
              value={field.formatting.color}
              onChange={(e) => onChange({ ...field, formatting: { ...field.formatting, color: e.target.value } })}
              className="h-9 w-10 cursor-pointer rounded-md border border-border p-1"
            />
          </label>
          <label className="flex items-center gap-1" title="Cell background color">
            <span className="text-[11px] text-muted-foreground">Cell</span>
            <input
              type="color"
              value={field.formatting.backgroundColor === "transparent" ? "#ffffff" : field.formatting.backgroundColor}
              onChange={(e) => onChange({ ...field, formatting: { ...field.formatting, backgroundColor: e.target.value } })}
              className="h-9 w-10 cursor-pointer rounded-md border border-border p-1"
            />
          </label>
          {field.formatting.backgroundColor !== "transparent" && (
            <button
              type="button"
              onClick={() => onChange({ ...field, formatting: { ...field.formatting, backgroundColor: "transparent" } })}
              title="Clear cell background"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-red-300 hover:text-red-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["marginTop", "marginBottom", "paddingX", "paddingY"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">
                {key === "marginTop" ? "Margin top" : key === "marginBottom" ? "Margin bottom" : key === "paddingX" ? "Padding X" : "Padding Y"}
              </span>
              <input
                type="number"
                min={0}
                value={field.formatting[key]}
                onChange={(e) => onChange({ ...field, formatting: { ...field.formatting, [key]: Number(e.target.value) || 0 } })}
                className="h-8 text-sm"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
