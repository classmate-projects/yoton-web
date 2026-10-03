"use client";

import { useState } from "react";
import { ToothRecord, ToothCondition, ToothSurface, ComplexityLevel, ToothNote, ToothTreatment } from "@/types/dental.type";
import { CONDITION_COLOR } from "./SurfaceBox";
import { Trash2, Plus } from "lucide-react";

const ALL_CONDITIONS: ToothCondition[] = [
  "Healthy", "Caries", "Filled", "Missing", "Implant",
  "Crown", "BridgeAbutment", "BridgePontic", "RCT",
  "ExtractionIndicated", "Fracture", "Watch",
];

const ALL_SURFACES: ToothSurface[] = ["M", "D", "B", "L", "O"];

const COMPLEXITY_OPTIONS: { value: ComplexityLevel; label: string }[] = [
  { value: "StraightForward",    label: "Straight Forward" },
  { value: "LowComplexity",      label: "Low Complexity" },
  { value: "ModerateComplexity", label: "Moderate Complexity" },
  { value: "HighComplexity",     label: "High Complexity" },
];

// ─── Clinical rule sets ───────────────────────────────────────────────────────
// Conditions that replace the whole tooth (mutually exclusive within this group)
const WHOLE_TOOTH_CONDITIONS: ToothCondition[] = [
  "Missing", "Implant", "Crown", "BridgeAbutment", "BridgePontic", "ExtractionIndicated",
];
// Surface-specific pathologies — require a natural tooth surface to exist
const SURFACE_SPECIFIC: ToothCondition[] = ["Caries", "Filled", "RCT", "Fracture", "Watch"];
// Tooth-absent conditions: no natural crown tissue → surfaces not applicable
const ABSENT_TOOTH: ToothCondition[] = ["Missing", "BridgePontic"];
// Conditions where decay-type pathologies can't occur
const NO_DECAY: ToothCondition[] = ["Missing", "BridgePontic", "Implant"];

interface Props {
  toothNumber: string;
  record: ToothRecord;
  onChange: (updated: ToothRecord) => void;
}

export default function ToothCaseSheet({ toothNumber, record, onChange }: Props) {
  const [noteText, setNoteText]           = useState("");
  const [treatmentText, setTreatmentText] = useState("");

  const notes: ToothNote[] = (() => {
    try { return JSON.parse(record.notesJson ?? "[]"); } catch { return []; }
  })();
  const treatments: ToothTreatment[] = (() => {
    try { return JSON.parse(record.treatmentsJson ?? "[]"); } catch { return []; }
  })();

  const update = (patch: Partial<ToothRecord>) => onChange({ ...record, ...patch });

  // ─── Clinical condition toggle with enforcement ───────────────────────────
  const toggleCondition = (c: ToothCondition) => {
    // Deselect — always allowed
    if (record.conditions.includes(c)) {
      update({ conditions: record.conditions.filter(x => x !== c) });
      return;
    }

    let newConditions = [...record.conditions, c];
    let newSurfaces   = [...record.surfaces];

    if (c === "Healthy") {
      // Healthy clears all pathological conditions and surfaces
      newConditions = ["Healthy"];
      newSurfaces   = [];
    } else if (c === "Missing") {
      // Missing tooth — no other conditions or surfaces apply
      newConditions = ["Missing"];
      newSurfaces   = [];
    } else if (c === "BridgePontic") {
      // Artificial pontic — no tooth tissue at all
      newConditions = ["BridgePontic"];
      newSurfaces   = [];
    } else if (c === "Implant") {
      // Implant replaces the tooth root and crown:
      //   - remove other whole-tooth conditions
      //   - remove caries / filled / RCT (implants don't decay)
      //   - clear surfaces (no natural enamel)
      newConditions = newConditions
        .filter(x => !WHOLE_TOOTH_CONDITIONS.includes(x) || x === c)
        .filter(x => !["Caries", "Filled", "RCT"].includes(x))
        .filter(x => x !== "Healthy");
      newSurfaces = [];
    } else if (WHOLE_TOOTH_CONDITIONS.includes(c)) {
      // Crown / BridgeAbutment / ExtractionIndicated:
      //   - mutually exclusive with other whole-tooth conditions
      //   - surface-specific pathologies (Caries, RCT, etc.) CAN still coexist
      newConditions = newConditions
        .filter(x => !WHOLE_TOOTH_CONDITIONS.includes(x) || x === c)
        .filter(x => x !== "Healthy");
    } else {
      // Surface-specific pathology (Caries, Filled, RCT, Fracture, Watch):
      //   - remove Healthy
      newConditions = newConditions.filter(x => x !== "Healthy");
    }

    update({ conditions: newConditions, surfaces: newSurfaces });
  };

  // ─── Which conditions are disabled (not applicable given current state) ───
  const isConditionDisabled = (c: ToothCondition): boolean => {
    if (record.conditions.includes(c)) return false; // can always deselect
    const hasMissing    = record.conditions.includes("Missing");
    const hasPontic     = record.conditions.includes("BridgePontic");
    const hasImplant    = record.conditions.includes("Implant");
    if (hasMissing  && c !== "Missing")                         return true;
    if (hasPontic   && c !== "BridgePontic")                    return true;
    if (hasImplant  && ["Caries","Filled","RCT","Missing","BridgePontic"].includes(c)) return true;
    return false;
  };

  // ─── Surface availability ─────────────────────────────────────────────────
  const surfacesDisabled = record.conditions.some(c => ABSENT_TOOTH.includes(c)) ||
                           record.conditions.includes("Implant");
  const surfacesDisabledReason = record.conditions.includes("Missing")
    ? "No surfaces — tooth is missing"
    : record.conditions.includes("BridgePontic")
    ? "No surfaces — bridge pontic has no natural tooth tissue"
    : record.conditions.includes("Implant")
    ? "No natural enamel surfaces — implant crown surfaces not charted here"
    : null;

  const toggleSurface = (s: ToothSurface) => {
    if (surfacesDisabled) return;
    const has = record.surfaces.includes(s);
    update({ surfaces: has ? record.surfaces.filter(x => x !== s) : [...record.surfaces, s] });
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const next: ToothNote[] = [...notes, { note: noteText.trim(), createdAt: new Date().toISOString() }];
    update({ notesJson: JSON.stringify(next) });
    setNoteText("");
  };

  const removeNote = (idx: number) =>
    update({ notesJson: JSON.stringify(notes.filter((_, i) => i !== idx)) });

  const addTreatment = () => {
    if (!treatmentText.trim()) return;
    const next: ToothTreatment[] = [...treatments, {
      detail: treatmentText.trim(),
      status: "Planned",
      date: new Date().toISOString().split("T")[0],
    }];
    update({ treatmentsJson: JSON.stringify(next) });
    setTreatmentText("");
  };

  const removeTreatment = (idx: number) =>
    update({ treatmentsJson: JSON.stringify(treatments.filter((_, i) => i !== idx)) });

  const updateTreatmentStatus = (idx: number, status: ToothTreatment["status"]) =>
    update({ treatmentsJson: JSON.stringify(treatments.map((t, i) => i === idx ? { ...t, status } : t)) });

  const isMissing = record.conditions.includes("Missing");

  // Condition display hint — show why a condition is disabled
  const disabledReason = (c: ToothCondition): string | null => {
    if (!isConditionDisabled(c)) return null;
    if (record.conditions.includes("Missing"))      return "Not applicable on a missing tooth";
    if (record.conditions.includes("BridgePontic")) return "Not applicable on a bridge pontic";
    if (record.conditions.includes("Implant") && ["Caries","Filled","RCT"].includes(c))
      return "Implants don't develop dental caries";
    return null;
  };

  return (
    <div className="p-4 space-y-5 text-sm">
      <h3 className="font-semibold text-base">
        Case Sheet — Tooth <span className="text-red-500">{toothNumber}</span>
      </h3>

      {/* ── Conditions ── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-2">Conditions</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CONDITIONS.map(c => {
            const active   = record.conditions.includes(c);
            const disabled = isConditionDisabled(c);
            const reason   = disabledReason(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => !disabled && toggleCondition(c)}
                title={reason ?? undefined}
                style={active ? { backgroundColor: CONDITION_COLOR[c], borderColor: CONDITION_COLOR[c] } : {}}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  disabled
                    ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                    : active
                    ? c === "Healthy"
                      ? "border-border text-foreground"
                      : "text-white"
                    : "border-border text-muted-foreground hover:border-foreground/40 cursor-pointer"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Affected Surfaces ── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-2">Affected Surfaces</p>
        {surfacesDisabledReason ? (
          <p className="text-xs text-muted-foreground/60 italic py-1">{surfacesDisabledReason}</p>
        ) : (
          <div className="flex gap-2">
            {ALL_SURFACES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSurface(s)}
                className={`w-9 h-9 rounded border text-sm font-semibold transition-colors ${
                  record.surfaces.includes(s)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Examination ── */}
      {!isMissing && (
        <section>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Examination</label>
          <textarea
            value={record.examination ?? ""}
            onChange={e => update({ examination: e.target.value })}
            rows={2}
            className="w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background"
            placeholder="Clinical findings…"
          />
        </section>
      )}

      {/* ── Mobility — not applicable for missing or pontic ── */}
      {!isMissing && !record.conditions.includes("BridgePontic") && (
        <section>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Mobility (0–3)</label>
          <input
            type="number" min={0} max={3}
            value={record.mobility ?? ""}
            onChange={e => update({ mobility: Number(e.target.value) })}
            className="w-20 text-sm border border-border rounded px-2 py-1 bg-background"
          />
        </section>
      )}

      {/* ── Diagnosis + Complexity ── */}
      <section>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Diagnosis</label>
        <textarea
          value={record.diagnosisText ?? ""}
          onChange={e => update({ diagnosisText: e.target.value })}
          rows={2}
          className="w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background mb-2"
          placeholder="Diagnosis…"
        />
        <div className="flex flex-wrap gap-2">
          {COMPLEXITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ complexity: record.complexity === opt.value ? undefined : opt.value })}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                record.complexity === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Dental Notes ── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-2">Dental Notes</p>
        {notes.length > 0 && (
          <div className="border border-border rounded mb-2 divide-y divide-border">
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2">
                <p className="flex-1 text-sm">{n.note}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
                <button type="button" onClick={() => removeNote(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addNote()}
            className="flex-1 text-sm border border-border rounded px-2 py-1.5 bg-background"
            placeholder="Add a note…"
          />
          <button type="button" onClick={addNote}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded hover:bg-accent transition-colors">
            <Plus size={13} /> Add
          </button>
        </div>
      </section>

      {/* ── Dental Treatments ── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-2">Dental Treatments</p>
        {treatments.length > 0 && (
          <div className="border border-border rounded mb-2 divide-y divide-border">
            {treatments.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <p className="flex-1 text-sm">{t.detail}</p>
                <select
                  value={t.status}
                  onChange={e => updateTreatmentStatus(i, e.target.value as ToothTreatment["status"])}
                  className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                >
                  <option value="Planned">Planned</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                <span className="text-xs text-muted-foreground shrink-0">{t.date}</span>
                <button type="button" onClick={() => removeTreatment(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={treatmentText}
            onChange={e => setTreatmentText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTreatment()}
            className="flex-1 text-sm border border-border rounded px-2 py-1.5 bg-background"
            placeholder="Add a treatment plan…"
          />
          <button type="button" onClick={addTreatment}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded hover:bg-accent transition-colors">
            <Plus size={13} /> Add
          </button>
        </div>
      </section>

      {/* ── Additional Notes ── */}
      <section>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Additional Notes</label>
        <textarea
          value={record.notes ?? ""}
          onChange={e => update({ notes: e.target.value })}
          rows={2}
          className="w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background"
          placeholder="Any other notes…"
        />
      </section>
    </div>
  );
}
