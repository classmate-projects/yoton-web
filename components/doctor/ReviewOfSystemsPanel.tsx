"use client";

export interface ReviewOfSystemsValue {
  rosConstitutional: string;
  rosEyeEarNoseMouthThroat: string;
  rosCardiovascular: string;
  rosRespiratory: string;
  rosGastroenterology: string;
  rosGenitourinary: string;
  rosMusculoskeletal: string;
  rosNeurological: string;
  rosPsychiatric: string;
  rosEndocrine: string;
  rosHematologic: string;
  rosAllergicImmunologic: string;
  rosIntegumentary: string;
}

const SYSTEMS: { key: keyof ReviewOfSystemsValue; label: string }[] = [
  { key: "rosConstitutional", label: "Constitutional Symptoms" },
  { key: "rosEyeEarNoseMouthThroat", label: "Eye / Ear / Nose / Mouth / Throat" },
  { key: "rosCardiovascular", label: "Cardiovascular" },
  { key: "rosRespiratory", label: "Respiratory" },
  { key: "rosGastroenterology", label: "Gastroenterology" },
  { key: "rosGenitourinary", label: "Genitourinary" },
  { key: "rosMusculoskeletal", label: "Musculoskeletal" },
  { key: "rosNeurological", label: "Neurological" },
  { key: "rosPsychiatric", label: "Psychiatric" },
  { key: "rosEndocrine", label: "Endocrine" },
  { key: "rosHematologic", label: "Hematologic" },
  { key: "rosAllergicImmunologic", label: "Allergic and Immunologic" },
  { key: "rosIntegumentary", label: "Integumentary" },
];

interface ReviewOfSystemsPanelProps {
  value: ReviewOfSystemsValue;
  onChange: (key: keyof ReviewOfSystemsValue, value: string) => void;
}

// Each system gets its own independently-stored text area — compact by default, but a
// plain <textarea> is user-resizable, so the doctor can drag it taller when needed.
export default function ReviewOfSystemsPanel({ value, onChange }: ReviewOfSystemsPanelProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SYSTEMS.map((system) => (
        <div key={system.key} className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">{system.label}</label>
          <textarea
            placeholder={`${system.label} findings...`}
            value={value[system.key]}
            onChange={(e) => onChange(system.key, e.target.value)}
            className="w-full min-h-14 text-sm"
          />
        </div>
      ))}
    </div>
  );
}
