"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";
import SurfaceBox from "./SurfaceBox";
import PerioGrid from "./PerioGrid";
import ToothCaseSheet from "./ToothCaseSheet";
import { DentalService } from "@/services/dental.service";
import {
  ToothRecord, PerioRecord, DentalChartType,
  ToothCondition, ToothSurface,
} from "@/types/dental.type";

// ─── Tooth number sets ────────────────────────────────────────────────────────
const ADULT_UPPER  = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const ADULT_LOWER  = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];
const PEDO_UPPER   = ["55","54","53","52","51","61","62","63","64","65"];
const PEDO_LOWER   = ["85","84","83","82","81","71","72","73","74","75"];

// ─── Tooth type classifier (for crown icon shape) ─────────────────────────────
type ToothShape = "incisor" | "canine" | "premolar" | "molar";

function toothShape(n: string): ToothShape {
  const num = parseInt(n, 10) % 10;
  if (num === 3) return "canine";
  if (num === 1 || num === 2) return "incisor";
  if (num === 4 || num === 5) return "premolar";
  return "molar";
}

function CrownIcon({ shape, isUpper, size = 32 }: { shape: ToothShape; isUpper: boolean; size?: number }) {
  const h = size * 0.7;
  const w = size;
  const flip = !isUpper ? `scale(1,-1) translate(0,${-h})` : undefined;
  let path = "";
  switch (shape) {
    case "incisor":
      path = `M${w*0.2},0 L${w*0.8},0 L${w*0.75},${h} L${w*0.25},${h} Z`;
      break;
    case "canine":
      path = `M${w*0.25},0 L${w*0.75},0 L${w*0.6},${h*0.6} L${w*0.5},${h} L${w*0.4},${h*0.6} Z`;
      break;
    case "premolar":
      path = `M${w*0.15},0 L${w*0.85},0 L${w*0.8},${h} L${w*0.2},${h} Z`;
      break;
    default: // molar
      path = `M${w*0.05},0 L${w*0.95},0 L${w*0.9},${h} L${w*0.1},${h} Z`;
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <g transform={flip}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.5} />
        {(shape === "premolar" || shape === "molar") && (
          <line x1={w*0.5} y1={0} x2={w*0.5} y2={h*0.4} stroke="currentColor" strokeWidth={0.8} opacity={0.4} />
        )}
        {shape === "molar" && (
          <line x1={w*0.25} y1={0} x2={w*0.25} y2={h*0.3} stroke="currentColor" strokeWidth={0.8} opacity={0.4} />
        )}
      </g>
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyTooth(toothNumber: string): ToothRecord {
  return { toothNumber, conditions: [], surfaces: [] };
}

function emptyPerio(toothNumber: string): PerioRecord {
  return { toothNumber };
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  encounterId: string;
  patientId: string;
}

type TabId = "chart" | "details" | "history";

export default function DentalChartSection({ encounterId, patientId }: Props) {
  const [chartType, setChartType] = useState<"Adult" | "Pediatric">("Adult");
  const [tab, setTab] = useState<TabId>("chart");
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedChart, setSavedChart] = useState<DentalChartType | null>(null);

  const [generalNotes, setGeneralNotes] = useState("");
  const [occlusionNotes, setOcclusionNotes] = useState("");
  const [softTissueNotes, setSoftTissueNotes] = useState("");
  const [radioGraphicFindings, setRadioGraphicFindings] = useState("");

  // Map: toothNumber → ToothRecord
  const [toothRecords, setToothRecords] = useState<Map<string, ToothRecord>>(new Map());
  // Map: toothNumber → PerioRecord
  const [perioRecords, setPerioRecords] = useState<Map<string, PerioRecord>>(new Map());

  const upperTeeth = chartType === "Adult" ? ADULT_UPPER : PEDO_UPPER;
  const lowerTeeth = chartType === "Adult" ? ADULT_LOWER : PEDO_LOWER;

  // ─── Load chart ─────────────────────────────────────────────────────────────
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
    } catch {
      // New chart — stay empty
    } finally {
      setIsLoading(false);
    }
  }, [encounterId, chartType]);

  useEffect(() => { loadChart(); }, [loadChart]);

  // ─── Tooth record helpers ────────────────────────────────────────────────────
  const getToothRecord = (n: string): ToothRecord => toothRecords.get(n) ?? emptyTooth(n);
  const getPerioRecord = (n: string): PerioRecord => perioRecords.get(n) ?? emptyPerio(n);

  const updateTooth = (updated: ToothRecord) => {
    setToothRecords(prev => new Map(prev).set(updated.toothNumber, updated));
  };

  const updatePerio = (tooth: string, field: keyof PerioRecord, value: string) => {
    setPerioRecords(prev => {
      const m = new Map(prev);
      const rec = m.get(tooth) ?? emptyPerio(tooth);
      m.set(tooth, { ...rec, [field]: value });
      return m;
    });
  };

  // ─── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await DentalService.saveChart({
        encounterId,
        patientId,
        chartType,
        generalNotes,
        occlusionNotes,
        softTissueNotes,
        radioGraphicFindings,
        toothRecords: Array.from(toothRecords.values()),
        periodontalRecords: Array.from(perioRecords.values()),
      });
      setSavedChart(result);
      toast.success("Dental chart saved");
    } catch {
      toast.error("Failed to save dental chart");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Tooth column ─────────────────────────────────────────────────────────────
  function ToothColumn({ n, isUpper }: { n: string; isUpper: boolean }) {
    const rec = getToothRecord(n);
    const shape = toothShape(n);
    return (
      <div className="flex flex-col items-center gap-0.5" style={{ width: 44 }}>
        {isUpper && (
          <span className="text-[11px] font-semibold text-red-500 leading-none">{n}</span>
        )}
        {isUpper && <CrownIcon shape={shape} isUpper size={44} />}
        <SurfaceBox
          conditions={rec.conditions}
          surfaces={rec.surfaces}
          isSelected={selectedTooth === n}
          onClick={() => setSelectedTooth(prev => prev === n ? null : n)}
          size={44}
        />
        {!isUpper && <CrownIcon shape={shape} isUpper={false} size={44} />}
        {!isUpper && (
          <span className="text-[11px] font-semibold text-red-500 leading-none">{n}</span>
        )}
      </div>
    );
  }

  // ─── Details table ────────────────────────────────────────────────────────────
  const allTeeth = [...upperTeeth, ...lowerTeeth];
  const filledTeeth = allTeeth.filter(n => {
    const r = toothRecords.get(n);
    return r && (r.conditions.length > 0 || r.surfaces.length > 0 || r.examination || r.diagnosisText);
  });

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
        <div className="flex gap-1">
          {(["chart","details","history"] as TabId[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "chart" ? "Tooth Chart" : t === "details" ? "Dental Details" : "Dental History"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded overflow-hidden border border-border text-xs">
            {(["Adult","Pediatric"] as const).map(ct => (
              <button key={ct} type="button" onClick={() => { setChartType(ct); setSelectedTooth(null); }}
                className={`px-3 py-1 transition-colors ${
                  chartType === ct ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
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
          {/* ── Tooth Chart tab ── */}
          {tab === "chart" && (
            <div className="p-4 space-y-4">
              {/* Upper arch PerioGrid */}
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Periodontal — Upper Arch</p>
                <div className="overflow-x-auto">
                  <PerioGrid
                    teeth={upperTeeth}
                    records={perioRecords}
                    onUpdate={updatePerio}
                    arch="upper"
                  />
                </div>
              </div>

              {/* Upper arch teeth */}
              <div className="overflow-x-auto">
                <div className="flex gap-1 justify-center min-w-fit mx-auto">
                  {upperTeeth.slice(0, upperTeeth.length / 2).map(n => (
                    <ToothColumn key={n} n={n} isUpper />
                  ))}
                  <div className="w-px bg-border mx-1 self-stretch" />
                  {upperTeeth.slice(upperTeeth.length / 2).map(n => (
                    <ToothColumn key={n} n={n} isUpper />
                  ))}
                </div>
              </div>

              {/* Midline */}
              <div className="relative flex items-center">
                <div className="flex-1 h-px bg-border" />
                <span className="mx-3 text-[10px] font-medium text-muted-foreground tracking-wider uppercase">Midline</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Lower arch teeth */}
              <div className="overflow-x-auto">
                <div className="flex gap-1 justify-center min-w-fit mx-auto">
                  {lowerTeeth.slice(0, lowerTeeth.length / 2).map(n => (
                    <ToothColumn key={n} n={n} isUpper={false} />
                  ))}
                  <div className="w-px bg-border mx-1 self-stretch" />
                  {lowerTeeth.slice(lowerTeeth.length / 2).map(n => (
                    <ToothColumn key={n} n={n} isUpper={false} />
                  ))}
                </div>
              </div>

              {/* Lower arch PerioGrid */}
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Periodontal — Lower Arch</p>
                <div className="overflow-x-auto">
                  <PerioGrid
                    teeth={lowerTeeth}
                    records={perioRecords}
                    onUpdate={updatePerio}
                    arch="lower"
                  />
                </div>
              </div>

              {/* Case sheet — expands below the arch when a tooth is selected */}
              {selectedTooth && (
                <div className="border border-border rounded-lg bg-background">
                  <ToothCaseSheet
                    toothNumber={selectedTooth}
                    record={getToothRecord(selectedTooth)}
                    onChange={updateTooth}
                  />
                </div>
              )}

              {/* General notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
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

          {/* ── Dental Details tab ── */}
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
                      const r = getToothRecord(n);
                      return (
                        <tr key={n} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                          onClick={() => { setTab("chart"); setSelectedTooth(n); }}>
                          <td className="py-2 pr-3 font-semibold text-red-500">{n}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {r.conditions.map(c => (
                                <span key={c} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${c === "Healthy" ? "#e5e7eb" : ""}` }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-3">{r.surfaces.join(", ") || "—"}</td>
                          <td className="py-2 pr-3 text-xs">{r.complexity?.replace(/([A-Z])/g, " $1").trim() ?? "—"}</td>
                          <td className="py-2 text-muted-foreground max-w-xs truncate">{r.diagnosisText || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Dental History tab ── */}
          {tab === "history" && (
            <div className="p-4">
              {savedChart ? (
                <div className="space-y-3 text-sm">
                  <div className="flex gap-6">
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
                <p className="text-sm text-muted-foreground text-center py-8">No saved chart found for this encounter.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
