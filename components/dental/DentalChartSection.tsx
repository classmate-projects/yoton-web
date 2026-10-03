"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Save, RefreshCw, X } from "lucide-react";
import SurfaceBox from "./SurfaceBox";
import ToothCaseSheet from "./ToothCaseSheet";
import { DentalService } from "@/services/dental.service";
import { ToothRecord, PerioRecord, DentalChartType } from "@/types/dental.type";

// ─── FDI tooth sets ───────────────────────────────────────────────────────────
// Displayed left-to-right from viewer's perspective (patient's right → left)
const ADULT_UPPER  = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const ADULT_LOWER  = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];
const PEDO_UPPER   = ["55","54","53","52","51","61","62","63","64","65"];
const PEDO_LOWER   = ["85","84","83","82","81","71","72","73","74","75"];

// ─── Tooth shape classifier ────────────────────────────────────────────────────
type ToothShape = "incisor" | "canine" | "premolar" | "molar";
function toothShape(n: string): ToothShape {
  const d = parseInt(n, 10) % 10;
  if (d === 3) return "canine";
  if (d === 1 || d === 2) return "incisor";
  if (d === 4 || d === 5) return "premolar";
  return "molar";
}

// Simplified anatomical crown SVG — distinct silhouette per type
function CrownSVG({ shape, isUpper, w = 40 }: { shape: ToothShape; isUpper: boolean; w?: number }) {
  const h = w * 0.75;
  const paths: Record<ToothShape, string> = {
    incisor:  `M${w*.22},0 L${w*.78},0 Q${w*.8},${h*.05} ${w*.75},${h} L${w*.25},${h} Q${w*.2},${h*.05} ${w*.22},0Z`,
    canine:   `M${w*.25},0 L${w*.75},0 L${w*.65},${h*.55} L${w*.5},${h} L${w*.35},${h*.55}Z`,
    premolar: `M${w*.15},0 Q${w*.35},${h*.1} ${w*.5},0 Q${w*.65},${h*.1} ${w*.85},0 L${w*.82},${h} L${w*.18},${h}Z`,
    molar:    `M${w*.05},0 Q${w*.25},${h*.12} ${w*.5},0 Q${w*.75},${h*.12} ${w*.95},0 L${w*.92},${h} L${w*.08},${h}Z`,
  };
  const flip = !isUpper ? `scale(1,-1) translate(0,${-h})` : undefined;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <g transform={flip}>
        <path d={paths[shape]} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.45} />
        {shape === "molar" && <line x1={w*.5} y1={0} x2={w*.5} y2={h*.45} stroke="currentColor" strokeWidth={0.7} opacity={0.3} />}
        {shape === "premolar" && <line x1={w*.5} y1={0} x2={w*.5} y2={h*.35} stroke="currentColor" strokeWidth={0.7} opacity={0.3} />}
      </g>
    </svg>
  );
}

// ─── Single perio cell (numeric depth) ───────────────────────────────────────
function DepthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value);
  return (
    <input
      type="number" min={0} max={20} value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-[22px] h-[22px] text-center text-[11px] border rounded-sm p-0 bg-transparent
        ${n >= 4 ? "text-red-500 font-bold border-red-400" : "border-border/60 text-muted-foreground"}`}
    />
  );
}

// ─── Single BOP toggle cell ───────────────────────────────────────────────────
function BopToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const on = value === "1";
  return (
    <button type="button" onClick={() => onChange(on ? "0" : "1")}
      className={`w-[22px] h-[22px] rounded-sm border text-[11px] font-bold transition-colors
        ${on ? "bg-red-500 text-white border-red-600" : "border-border/60 text-muted-foreground/40"}`}>
      {on ? "+" : "·"}
    </button>
  );
}

// ─── A single row of perio data across all teeth ──────────────────────────────
type PerioField = keyof PerioRecord;
function PerioRow({
  teeth, records, field, label, isBop, onUpdate, TOOTH_W,
}: {
  teeth: string[];
  records: Map<string, PerioRecord>;
  field: PerioField;
  label: string;
  isBop?: boolean;
  onUpdate: (tooth: string, field: PerioField, value: string) => void;
  TOOTH_W: number;
}) {
  const half = teeth.length / 2;

  function parseSites(csv: string | undefined): [string, string, string] {
    const p = (csv ?? "").split(",");
    return [p[0] ?? "", p[1] ?? "", p[2] ?? ""];
  }
  function setSite(csv: string | undefined, idx: number, val: string) {
    const p = parseSites(csv);
    p[idx] = val;
    return p.join(",");
  }

  return (
    <div className="flex items-center" style={{ minWidth: teeth.length * TOOTH_W + 60 }}>
      {/* Label */}
      <div className="w-[56px] shrink-0 text-right pr-1.5 text-[10px] text-muted-foreground leading-none">
        {label}
      </div>
      {/* Left half */}
      <div className="flex">
        {teeth.slice(0, half).map(t => {
          const csv = records.get(t)?.[field] as string | undefined;
          const sites = parseSites(csv);
          return (
            <div key={t} className="flex justify-center gap-[1px]" style={{ width: TOOTH_W }}>
              {sites.map((v, i) =>
                isBop
                  ? <BopToggle key={i} value={v} onChange={val => onUpdate(t, field, setSite(csv, i, val))} />
                  : <DepthInput key={i} value={v} onChange={val => onUpdate(t, field, setSite(csv, i, val))} />
              )}
            </div>
          );
        })}
      </div>
      {/* Midline gap */}
      <div className="w-3 shrink-0" />
      {/* Right half */}
      <div className="flex">
        {teeth.slice(half).map(t => {
          const csv = records.get(t)?.[field] as string | undefined;
          const sites = parseSites(csv);
          return (
            <div key={t} className="flex justify-center gap-[1px]" style={{ width: TOOTH_W }}>
              {sites.map((v, i) =>
                isBop
                  ? <BopToggle key={i} value={v} onChange={val => onUpdate(t, field, setSite(csv, i, val))} />
                  : <DepthInput key={i} value={v} onChange={val => onUpdate(t, field, setSite(csv, i, val))} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── The arch row (crowns + surface boxes + FDI numbers) ──────────────────────
function ArchRow({
  teeth, isUpper, selectedTooth, toothRecords, onToothClick, TOOTH_W,
}: {
  teeth: string[];
  isUpper: boolean;
  selectedTooth: string | null;
  toothRecords: Map<string, ToothRecord>;
  onToothClick: (n: string) => void;
  TOOTH_W: number;
}) {
  const half = teeth.length / 2;
  const emptyRec = (n: string): ToothRecord => ({ toothNumber: n, conditions: [], surfaces: [] });

  function ToothCol({ n }: { n: string }) {
    const rec = toothRecords.get(n) ?? emptyRec(n);
    const shape = toothShape(n);
    return (
      <div className="flex flex-col items-center" style={{ width: TOOTH_W }}>
        {isUpper && <span className="text-[10px] font-semibold text-red-500 leading-none mb-0.5">{n}</span>}
        {isUpper && <CrownSVG shape={shape} isUpper w={TOOTH_W - 2} />}
        <SurfaceBox
          conditions={rec.conditions}
          surfaces={rec.surfaces}
          isSelected={selectedTooth === n}
          onClick={() => onToothClick(n)}
          size={TOOTH_W - 2}
        />
        {!isUpper && <CrownSVG shape={shape} isUpper={false} w={TOOTH_W - 2} />}
        {!isUpper && <span className="text-[10px] font-semibold text-red-500 leading-none mt-0.5">{n}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-end" style={{ minWidth: teeth.length * TOOTH_W + 60 }}>
      <div className="w-[56px] shrink-0" />
      <div className="flex">
        {teeth.slice(0, half).map(n => <ToothCol key={n} n={n} />)}
      </div>
      <div className="w-3 shrink-0 self-stretch flex items-center">
        <div className="w-px h-full bg-border mx-auto" />
      </div>
      <div className="flex">
        {teeth.slice(half).map(n => <ToothCol key={n} n={n} />)}
      </div>
    </div>
  );
}

// ─── Divider line ─────────────────────────────────────────────────────────────
function ArchDivider({ label, teeth, TOOTH_W }: { label: string; teeth: string[]; TOOTH_W: number }) {
  return (
    <div className="flex items-center" style={{ minWidth: teeth.length * TOOTH_W + 60 }}>
      <div className="w-[56px] shrink-0" />
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase px-1">{label}</span>
        <div className="flex-1 h-px bg-border/60" />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyPerio(toothNumber: string): PerioRecord { return { toothNumber }; }

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { encounterId: string; patientId: string; }
type TabId = "chart" | "details" | "history";

export default function DentalChartSection({ encounterId, patientId }: Props) {
  const [chartType, setChartType]           = useState<"Adult" | "Pediatric">("Adult");
  const [tab, setTab]                       = useState<TabId>("chart");
  const [selectedTooth, setSelectedTooth]   = useState<string | null>(null);
  const [isSaving, setIsSaving]             = useState(false);
  const [isLoading, setIsLoading]           = useState(true);
  const [savedChart, setSavedChart]         = useState<DentalChartType | null>(null);

  const [generalNotes,       setGeneralNotes]       = useState("");
  const [occlusionNotes,     setOcclusionNotes]     = useState("");
  const [softTissueNotes,    setSoftTissueNotes]    = useState("");
  const [radioGraphicFindings, setRadioGraphicFindings] = useState("");

  const [toothRecords, setToothRecords] = useState<Map<string, ToothRecord>>(new Map());
  const [perioRecords, setPerioRecords] = useState<Map<string, PerioRecord>>(new Map());

  const upperTeeth = chartType === "Adult" ? ADULT_UPPER : PEDO_UPPER;
  const lowerTeeth = chartType === "Adult" ? ADULT_LOWER : PEDO_LOWER;

  // Each tooth column width — sized so all 16 adult teeth fit in ~720 px
  const TOOTH_W = chartType === "Adult" ? 44 : 56;

  // ─── Load ─────────────────────────────────────────────────────────────────
  const loadChart = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await DentalService.getChart(encounterId, chartType);
      setSavedChart(data);
      if (data) {
        setGeneralNotes(data.generalNotes ?? "");
        setOcclusionNotes(data.occlusionNotes ?? "");
        setSoftTissueNotes(data.softTissueNotes ?? "");
        setRadioGraphicFindings(data.radioGraphicFindings ?? "");
        const tm = new Map<string, ToothRecord>();
        data.toothRecords.forEach(r => tm.set(r.toothNumber, r));
        setToothRecords(tm);
        const pm = new Map<string, PerioRecord>();
        data.periodontalRecords.forEach(r => pm.set(r.toothNumber, r));
        setPerioRecords(pm);
      }
    } catch { /* new chart */ }
    finally { setIsLoading(false); }
  }, [encounterId, chartType]);

  useEffect(() => { loadChart(); }, [loadChart]);

  // ─── Perio update ─────────────────────────────────────────────────────────
  const updatePerio = (tooth: string, field: PerioField, value: string) => {
    setPerioRecords(prev => {
      const m = new Map(prev);
      m.set(tooth, { ...(m.get(tooth) ?? emptyPerio(tooth)), [field]: value });
      return m;
    });
  };

  // ─── Tooth update ─────────────────────────────────────────────────────────
  const updateTooth = (updated: ToothRecord) =>
    setToothRecords(prev => new Map(prev).set(updated.toothNumber, updated));

  const handleToothClick = (n: string) =>
    setSelectedTooth(prev => prev === n ? null : n);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await DentalService.saveChart({
        encounterId, patientId, chartType,
        generalNotes, occlusionNotes, softTissueNotes, radioGraphicFindings,
        toothRecords: Array.from(toothRecords.values()),
        periodontalRecords: Array.from(perioRecords.values()),
      });
      setSavedChart(result);
      toast.success("Dental chart saved");
    } catch { toast.error("Failed to save dental chart"); }
    finally { setIsSaving(false); }
  };

  // ─── Details list ─────────────────────────────────────────────────────────
  const allTeeth = [...upperTeeth, ...lowerTeeth];
  const filledTeeth = allTeeth.filter(n => {
    const r = toothRecords.get(n);
    return r && (r.conditions.length > 0 || r.surfaces.length > 0 || r.examination || r.diagnosisText);
  });

  const perioPropArgs = { records: perioRecords, onUpdate: updatePerio, TOOTH_W };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full border border-border rounded-lg bg-card">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/40 rounded-t-lg">
        <div className="flex gap-1">
          {(["chart", "details", "history"] as TabId[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t === "chart" ? "Tooth Chart" : t === "details" ? "Dental Details" : "Dental History"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-border text-xs">
            {(["Adult", "Pediatric"] as const).map(ct => (
              <button key={ct} type="button"
                onClick={() => { setChartType(ct); setSelectedTooth(null); }}
                className={`px-3 py-1.5 transition-colors ${
                  chartType === ct ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}>
                {ct}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            <Save size={13} /> {isSaving ? "Saving…" : "Save Chart"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading chart…
        </div>
      ) : (
        <>
          {/* ════════════════ TOOTH CHART TAB ════════════════ */}
          {tab === "chart" && (
            <div className="p-4 space-y-1 overflow-x-auto">

              {/* ── UPPER ARCH ── */}
              {/* Buccal perio — above upper arch */}
              <PerioRow teeth={upperTeeth} field="buccalProbing"   label="Probing"   {...perioPropArgs} />
              <PerioRow teeth={upperTeeth} field="buccalBop"       label="BOP"       isBop {...perioPropArgs} />
              <PerioRow teeth={upperTeeth} field="buccalRecession" label="Recession" {...perioPropArgs} />

              <ArchDivider label="Upper" teeth={upperTeeth} TOOTH_W={TOOTH_W} />

              {/* Upper crowns + surface boxes */}
              <ArchRow
                teeth={upperTeeth} isUpper
                selectedTooth={selectedTooth}
                toothRecords={toothRecords}
                onToothClick={handleToothClick}
                TOOTH_W={TOOTH_W}
              />

              {/* Lingual perio — below upper arch */}
              <PerioRow teeth={upperTeeth} field="lingualRecession" label="Recession" {...perioPropArgs} />
              <PerioRow teeth={upperTeeth} field="lingualBop"       label="BOP"       isBop {...perioPropArgs} />
              <PerioRow teeth={upperTeeth} field="lingualProbing"   label="Probing"   {...perioPropArgs} />

              {/* ── MIDLINE ── */}
              <ArchDivider label="Midline" teeth={upperTeeth} TOOTH_W={TOOTH_W} />

              {/* ── LOWER ARCH ── */}
              {/* Lingual perio — above lower arch */}
              <PerioRow teeth={lowerTeeth} field="lingualProbing"   label="Probing"   {...perioPropArgs} />
              <PerioRow teeth={lowerTeeth} field="lingualBop"       label="BOP"       isBop {...perioPropArgs} />
              <PerioRow teeth={lowerTeeth} field="lingualRecession" label="Recession" {...perioPropArgs} />

              <ArchDivider label="Lower" teeth={lowerTeeth} TOOTH_W={TOOTH_W} />

              {/* Lower crowns + surface boxes */}
              <ArchRow
                teeth={lowerTeeth} isUpper={false}
                selectedTooth={selectedTooth}
                toothRecords={toothRecords}
                onToothClick={handleToothClick}
                TOOTH_W={TOOTH_W}
              />

              {/* Buccal perio — below lower arch */}
              <PerioRow teeth={lowerTeeth} field="buccalRecession" label="Recession" {...perioPropArgs} />
              <PerioRow teeth={lowerTeeth} field="buccalBop"       label="BOP"       isBop {...perioPropArgs} />
              <PerioRow teeth={lowerTeeth} field="buccalProbing"   label="Probing"   {...perioPropArgs} />

              {/* ── Case sheet inline when tooth selected ── */}
              {selectedTooth && (
                <div className="mt-4 border border-border rounded-lg bg-background relative">
                  <button type="button" onClick={() => setSelectedTooth(null)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                    <X size={16} />
                  </button>
                  <ToothCaseSheet
                    toothNumber={selectedTooth}
                    record={toothRecords.get(selectedTooth) ?? { toothNumber: selectedTooth, conditions: [], surfaces: [] }}
                    onChange={updateTooth}
                  />
                </div>
              )}

              {/* ── General notes ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mt-2 border-t border-border">
                {([
                  ["General Notes", generalNotes, setGeneralNotes],
                  ["Occlusion Notes", occlusionNotes, setOcclusionNotes],
                  ["Soft Tissue Notes", softTissueNotes, setSoftTissueNotes],
                  ["Radiographic Findings", radioGraphicFindings, setRadioGraphicFindings],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                    <textarea
                      value={val}
                      onChange={e => setter(e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background"
                      placeholder={label + "…"}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════ DENTAL DETAILS TAB ════════════════ */}
          {tab === "details" && (
            <div className="p-4">
              {filledTeeth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tooth findings recorded yet.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Tooth</th>
                      <th className="py-2 pr-3 font-medium">Conditions</th>
                      <th className="py-2 pr-3 font-medium">Surfaces</th>
                      <th className="py-2 pr-3 font-medium">Complexity</th>
                      <th className="py-2 font-medium">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledTeeth.map(n => {
                      const r = toothRecords.get(n)!;
                      return (
                        <tr key={n}
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                          onClick={() => { setTab("chart"); setSelectedTooth(n); }}>
                          <td className="py-2 pr-3 font-semibold text-red-500">{n}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {r.conditions.map(c => (
                                <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-muted">{c}</span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-3">{r.surfaces.join(", ") || "—"}</td>
                          <td className="py-2 pr-3 text-xs">
                            {r.complexity?.replace(/([A-Z])/g, " $1").trim() ?? "—"}
                          </td>
                          <td className="py-2 text-muted-foreground max-w-xs truncate">{r.diagnosisText || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ════════════════ DENTAL HISTORY TAB ════════════════ */}
          {tab === "history" && (
            <div className="p-4">
              {savedChart ? (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <span className="text-xs text-muted-foreground">Chart Type</span>
                      <p className="font-medium">{savedChart.chartType}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Last Updated</span>
                      <p className="font-medium">{new Date(savedChart.updatedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Created</span>
                      <p className="font-medium">{new Date(savedChart.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Teeth with findings</span>
                      <p className="font-medium">{savedChart.toothRecords.length}</p>
                    </div>
                  </div>
                  {savedChart.generalNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">General Notes</p>
                      <p className="mt-0.5">{savedChart.generalNotes}</p>
                    </div>
                  )}
                  {savedChart.radioGraphicFindings && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Radiographic Findings</p>
                      <p className="mt-0.5">{savedChart.radioGraphicFindings}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No saved chart found for this encounter.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
