"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Save, RefreshCw, X } from "lucide-react";
import SurfaceBox from "./SurfaceBox";
import ToothCaseSheet from "./ToothCaseSheet";
import { DentalService } from "@/services/dental.service";
import { ToothRecord, PerioRecord, DentalChartType } from "@/types/dental.type";

// ─── Universal (US) adult numbering & alphabetic pediatric ───────────────────
// Adult: 1-16 upper (patient right→left), 32-17 lower (patient right→left)
// Pediatric: a-j upper, t-k lower (patient right→left)
const ADULT_UPPER = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"];
const ADULT_LOWER = ["32","31","30","29","28","27","26","25","24","23","22","21","20","19","18","17"];
const PEDO_UPPER  = ["a","b","c","d","e","f","g","h","i","j"];
const PEDO_LOWER  = ["t","s","r","q","p","o","n","m","l","k"];

type ToothShape = "incisor" | "canine" | "premolar" | "molar";

// Shape lookup by Universal number / pediatric letter
const TOOTH_SHAPE_MAP: Record<string, ToothShape> = {
  // Adult upper
  "1":"molar","2":"molar","3":"molar","4":"premolar","5":"premolar",
  "6":"canine","7":"incisor","8":"incisor","9":"incisor","10":"incisor",
  "11":"canine","12":"premolar","13":"premolar","14":"molar","15":"molar","16":"molar",
  // Adult lower
  "17":"molar","18":"molar","19":"molar","20":"premolar","21":"premolar",
  "22":"canine","23":"incisor","24":"incisor","25":"incisor","26":"incisor",
  "27":"canine","28":"premolar","29":"premolar","30":"molar","31":"molar","32":"molar",
  // Pediatric upper  (a=upper-right 2nd molar … e=upper-right central; f=upper-left central … j=upper-left 2nd molar)
  "a":"molar","b":"molar","c":"canine","d":"incisor","e":"incisor",
  "f":"incisor","g":"incisor","h":"canine","i":"molar","j":"molar",
  // Pediatric lower  (t=lower-right 2nd molar … p=lower-right central; o=lower-left central … k=lower-left 2nd molar)
  "t":"molar","s":"molar","r":"canine","q":"incisor","p":"incisor",
  "o":"incisor","n":"incisor","m":"canine","l":"molar","k":"molar",
};

function toothShape(n: string): ToothShape {
  return TOOTH_SHAPE_MAP[n] ?? "incisor";
}

// ─── Anatomical crown/root SVG ────────────────────────────────────────────────
function ToothAnatomySVG({ shape, isUpper, w = 40 }: { shape: ToothShape; isUpper: boolean; w?: number }) {
  const crownH = w * 0.65;
  const rootH  = w * 0.85;
  const totalH = crownH + rootH;

  const crownPaths: Record<ToothShape, string> = {
    incisor:  `M${w*.22},0 L${w*.78},0 Q${w*.8},${crownH*.15} ${w*.75},${crownH} L${w*.25},${crownH} Q${w*.2},${crownH*.15} ${w*.22},0Z`,
    canine:   `M${w*.25},0 L${w*.75},0 L${w*.68},${crownH*.6} L${w*.5},${crownH} L${w*.32},${crownH*.6}Z`,
    premolar: `M${w*.14},0 Q${w*.35},${crownH*.18} ${w*.5},0 Q${w*.65},${crownH*.18} ${w*.86},0 L${w*.84},${crownH} L${w*.16},${crownH}Z`,
    molar:    `M${w*.05},0 Q${w*.25},${crownH*.2} ${w*.5},0 Q${w*.75},${crownH*.2} ${w*.95},0 L${w*.92},${crownH} L${w*.08},${crownH}Z`,
  };

  // Root shapes per tooth type (single root for incisors/canines, split for molars)
  const rootPath: Record<ToothShape, string> = {
    incisor:  `M${w*.3},${crownH} L${w*.7},${crownH} Q${w*.68},${totalH*.75} ${w*.5},${totalH} Q${w*.32},${totalH*.75} ${w*.3},${crownH}Z`,
    canine:   `M${w*.28},${crownH} L${w*.72},${crownH} Q${w*.68},${totalH*.8} ${w*.5},${totalH} Q${w*.32},${totalH*.8} ${w*.28},${crownH}Z`,
    premolar: `M${w*.22},${crownH} L${w*.78},${crownH} Q${w*.73},${crownH+rootH*.4} ${w*.63},${crownH+rootH*.55} Q${w*.58},${totalH} ${w*.5},${totalH-rootH*.05} Q${w*.42},${totalH} ${w*.37},${crownH+rootH*.55} Q${w*.27},${crownH+rootH*.4} ${w*.22},${crownH}Z`,
    molar:    `M${w*.08},${crownH} L${w*.92},${crownH} L${w*.85},${crownH+rootH*.45} Q${w*.72},${totalH} ${w*.62},${totalH-rootH*.08} Q${w*.55},${totalH} ${w*.5},${totalH-rootH*.04} Q${w*.45},${totalH} ${w*.38},${totalH-rootH*.08} Q${w*.28},${totalH} ${w*.15},${crownH+rootH*.45}Z`,
  };

  // For upper teeth: crown at top, root points down. For lower: flip vertically.
  const flip = !isUpper;
  const translateY = flip ? totalH : 0;
  const scaleY = flip ? -1 : 1;

  return (
    <svg
      width={w}
      height={totalH}
      viewBox={`0 0 ${w} ${totalH}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <g transform={`translate(0,${translateY}) scale(1,${scaleY})`}>
        {/* Root */}
        <path d={rootPath[shape]} fill="none" stroke="currentColor" strokeWidth={0.8} opacity={0.35} />
        {/* Crown */}
        <path d={crownPaths[shape]} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.55} />
        {/* Molar cusp line */}
        {shape === "molar" && (
          <line x1={w*.5} y1={0} x2={w*.5} y2={crownH*.5} stroke="currentColor" strokeWidth={0.6} opacity={0.3} />
        )}
        {/* Premolar cusp line */}
        {shape === "premolar" && (
          <line x1={w*.5} y1={0} x2={w*.5} y2={crownH*.4} stroke="currentColor" strokeWidth={0.6} opacity={0.3} />
        )}
      </g>
    </svg>
  );
}

// ─── Per-tooth BOP indicator (single toggle per tooth) ───────────────────────
function BopDot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const on = value === "1";
  return (
    <button
      type="button"
      onClick={() => onChange(on ? "0" : "1")}
      className={`w-4 h-4 rounded-full border text-[8px] font-bold transition-colors ${
        on
          ? "bg-red-500 border-red-600 text-white"
          : "border-border/50 bg-background/60 text-transparent hover:border-border"
      }`}
      title={on ? "BOP positive" : "BOP negative"}
    />
  );
}

// ─── Perio depth input (for periodontal tab) ──────────────────────────────────
function DepthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value);
  return (
    <input
      type="number" min={0} max={20} value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-[22px] h-[22px] text-center text-[10px] border rounded-sm p-0 bg-transparent
        ${n >= 4 ? "text-red-500 font-bold border-red-400" : "border-border/60 text-muted-foreground"}`}
    />
  );
}

// ─── Perio BOP toggle (for periodontal tab) ───────────────────────────────────
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

// ─── Full-width perio row (stretches to fill container width) ────────────────
type PerioField = keyof PerioRecord;

function PerioRowFull({
  teeth, records, field, label, isBop, onUpdate,
}: {
  teeth: string[];
  records: Map<string, PerioRecord>;
  field: PerioField;
  label: string;
  isBop?: boolean;
  onUpdate: (tooth: string, field: PerioField, value: string) => void;
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

  function ToothCells({ t }: { t: string }) {
    const csv = records.get(t)?.[field] as string | undefined;
    const sites = parseSites(csv);
    return (
      <div className="w-[106px] shrink-0 flex items-center justify-center gap-[2px] py-1.5">
        {sites.map((v, i) =>
          isBop ? (
            <button
              key={i} type="button"
              onClick={() => onUpdate(t, field, setSite(csv, i, v === "1" ? "0" : "1"))}
              className={`w-[34px] h-[34px] shrink-0 rounded-sm border-2 text-xs font-bold transition-colors ${
                v === "1" ? "bg-red-500 text-white border-red-600" : "border-border text-muted-foreground/50"
              }`}
            >
              {v === "1" ? "+" : "·"}
            </button>
          ) : (
            <input
              key={i} type="number" min={0} max={20} value={v}
              onChange={e => onUpdate(t, field, setSite(csv, i, e.target.value))}
              className={`w-[34px] h-[34px] shrink-0 text-center text-xs border-2 rounded-sm p-0 bg-transparent ${
                Number(v) >= 4 ? "text-red-500 font-bold border-red-400" : "border-border text-muted-foreground"
              }`}
            />
          )
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center h-[52px] border-b border-border/20">
      <div className="w-[84px] shrink-0 text-right pr-3 text-[10px] text-muted-foreground leading-none">{label}</div>
      <div className="flex border-r border-border/30">
        {teeth.slice(0, half).map(t => <ToothCells key={t} t={t} />)}
      </div>
      <div className="w-5 shrink-0" />
      <div className="flex border-l border-border/30">
        {teeth.slice(half).map(t => <ToothCells key={t} t={t} />)}
      </div>
    </div>
  );
}

// ─── Tooth number strip for perio tab ────────────────────────────────────────
function PerioToothNumbers({ teeth }: { teeth: string[] }) {
  const half = teeth.length / 2;
  return (
    <div className="flex w-full items-center py-3">
      <div className="w-[84px] shrink-0" />
      <div className="flex border-r border-border/30">
        {teeth.slice(0, half).map(n => (
          <div key={n} className="w-[106px] text-[11px] text-red-500 font-semibold text-center">{n}</div>
        ))}
      </div>
      <div className="w-5 shrink-0 flex items-center justify-center">
        <div className="w-px h-4 bg-border/40" />
      </div>
      <div className="flex border-l border-border/30">
        {teeth.slice(half).map(n => (
          <div key={n} className="w-[106px] text-[11px] text-red-500 font-semibold text-center">{n}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Tooth number + anatomy + surface box column ──────────────────────────────
function ToothCol({
  n, isUpper, isSelected, record, bopValue, onToothClick, onBopChange, TOOTH_W,
}: {
  n: string;
  isUpper: boolean;
  isSelected: boolean;
  record: ToothRecord;
  bopValue: string;
  onToothClick: () => void;
  onBopChange: (v: string) => void;
  TOOTH_W: number;
}) {
  const shape = toothShape(n);
  const anatomyW = TOOTH_W - 4;

  return (
    <div className="flex flex-col items-center" style={{ width: TOOTH_W }}>
      {isUpper && (
        <>
          {/* BOP indicator — above upper arch */}
          <div className="flex justify-center h-5 items-center">
            <BopDot value={bopValue} onChange={onBopChange} />
          </div>
          {/* FDI number */}
          <span className="text-[9px] font-semibold text-red-500 leading-none my-0.5">{n}</span>
          {/* Crown anatomy */}
          <ToothAnatomySVG shape={shape} isUpper w={anatomyW} />
          {/* Surface odontogram */}
          <div className="mt-0.5">
            <SurfaceBox
              conditions={record.conditions}
              surfaces={record.surfaces}
              isSelected={isSelected}
              onClick={onToothClick}
              size={TOOTH_W - 4}
            />
          </div>
        </>
      )}
      {!isUpper && (
        <>
          {/* Surface odontogram */}
          <SurfaceBox
            conditions={record.conditions}
            surfaces={record.surfaces}
            isSelected={isSelected}
            onClick={onToothClick}
            size={TOOTH_W - 4}
          />
          {/* Crown anatomy */}
          <div className="mt-0.5">
            <ToothAnatomySVG shape={shape} isUpper={false} w={anatomyW} />
          </div>
          {/* FDI number */}
          <span className="text-[9px] font-semibold text-red-500 leading-none my-0.5">{n}</span>
          {/* BOP indicator — below lower arch */}
          <div className="flex justify-center h-5 items-center">
            <BopDot value={bopValue} onChange={onBopChange} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Full arch row ────────────────────────────────────────────────────────────
function ArchRow({
  teeth, isUpper, selectedTooth, toothRecords, perioRecords, onToothClick, onBopChange, TOOTH_W,
}: {
  teeth: string[];
  isUpper: boolean;
  selectedTooth: string | null;
  toothRecords: Map<string, ToothRecord>;
  perioRecords: Map<string, PerioRecord>;
  onToothClick: (n: string) => void;
  onBopChange: (tooth: string, v: string) => void;
  TOOTH_W: number;
}) {
  const half = teeth.length / 2;
  const emptyRec = (n: string): ToothRecord => ({ toothNumber: n, conditions: [], surfaces: [] });

  const getBopValue = (n: string): string => {
    const csv = perioRecords.get(n)?.buccalBop ?? "";
    return csv.split(",")[1] ?? "";
  };

  return (
    <div className="flex" style={{ minWidth: teeth.length * TOOTH_W + 12 }}>
      <div className="flex">
        {teeth.slice(0, half).map(n => (
          <ToothCol
            key={n} n={n} isUpper={isUpper}
            isSelected={selectedTooth === n}
            record={toothRecords.get(n) ?? emptyRec(n)}
            bopValue={getBopValue(n)}
            onToothClick={() => onToothClick(n)}
            onBopChange={v => onBopChange(n, v)}
            TOOTH_W={TOOTH_W}
          />
        ))}
      </div>
      {/* Midline divider */}
      <div className="w-3 shrink-0 self-stretch flex items-center justify-center">
        <div className="w-px h-full bg-border/60" />
      </div>
      <div className="flex">
        {teeth.slice(half).map(n => (
          <ToothCol
            key={n} n={n} isUpper={isUpper}
            isSelected={selectedTooth === n}
            record={toothRecords.get(n) ?? emptyRec(n)}
            bopValue={getBopValue(n)}
            onToothClick={() => onToothClick(n)}
            onBopChange={v => onBopChange(n, v)}
            TOOTH_W={TOOTH_W}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Arch label strip ─────────────────────────────────────────────────────────
function ArchLabel({ label, teeth, TOOTH_W }: { label: string; teeth: string[]; TOOTH_W: number }) {
  return (
    <div className="flex items-center my-1" style={{ minWidth: teeth.length * TOOTH_W + 12 }}>
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase px-2">{label}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyPerio(toothNumber: string): PerioRecord { return { toothNumber }; }

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { encounterId: string; patientId: string; }
type TabId = "chart" | "perio" | "details" | "history";

export default function DentalChartSection({ encounterId, patientId }: Props) {
  const [chartType, setChartType]         = useState<"Adult" | "Pediatric">("Adult");
  const [tab, setTab]                     = useState<TabId>("chart");
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [isSaving, setIsSaving]           = useState(false);
  const [isLoading, setIsLoading]         = useState(true);
  const [savedChart, setSavedChart]       = useState<DentalChartType | null>(null);

  const [generalNotes,         setGeneralNotes]         = useState("");
  const [occlusionNotes,       setOcclusionNotes]       = useState("");
  const [softTissueNotes,      setSoftTissueNotes]      = useState("");
  const [radioGraphicFindings, setRadioGraphicFindings] = useState("");

  const [toothRecords, setToothRecords] = useState<Map<string, ToothRecord>>(new Map());
  const [perioRecords, setPerioRecords] = useState<Map<string, PerioRecord>>(new Map());
  // When a new encounter has no chart yet, the previous visit's chart is pre-loaded so
  // the doctor can see the patient's last-known dental state and update it. This banner
  // date drives a visible callout so the doctor knows the data isn't yet saved for THIS visit.
  const [preFillDate, setPreFillDate] = useState<string | null>(null);

  const upperTeeth = chartType === "Adult" ? ADULT_UPPER : PEDO_UPPER;
  const lowerTeeth = chartType === "Adult" ? ADULT_LOWER : PEDO_LOWER;
  const TOOTH_W    = chartType === "Adult" ? 58 : 72;

  // ─── Load ─────────────────────────────────────────────────────────────────
  function applyChartData(data: DentalChartType) {
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

  const loadChart = useCallback(async () => {
    setIsLoading(true);
    setPreFillDate(null);
    try {
      const data = await DentalService.getChart(encounterId, chartType);
      setSavedChart(data);
      if (data) {
        applyChartData(data);
      } else {
        // No chart for this encounter yet — pre-fill from the patient's most recent
        // past chart so the doctor can see the patient's last-known dental state.
        const previous = await DentalService.getPreviousChart(patientId, chartType, encounterId);
        if (previous) {
          applyChartData(previous);
          setPreFillDate(previous.updatedAt);
        }
      }
    } catch { /* leave blank */ }
    finally { setIsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, patientId, chartType]);

  useEffect(() => { loadChart(); }, [loadChart]);

  // ─── Perio update ─────────────────────────────────────────────────────────
  const updatePerio = (tooth: string, field: PerioField, value: string) => {
    setPerioRecords(prev => {
      const m = new Map(prev);
      m.set(tooth, { ...(m.get(tooth) ?? emptyPerio(tooth)), [field]: value });
      return m;
    });
  };

  // Quick BOP toggle used on main chart (writes to buccalBop middle site)
  const handleBopChange = (tooth: string, v: string) => {
    setPerioRecords(prev => {
      const m = new Map(prev);
      const rec = m.get(tooth) ?? emptyPerio(tooth);
      const parts = (rec.buccalBop ?? ",,").split(",");
      parts[1] = v;
      m.set(tooth, { ...rec, buccalBop: parts.join(",") });
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
      setPreFillDate(null);
      toast.success("Dental chart saved");
    } catch { toast.error("Failed to save dental chart"); }
    finally { setIsSaving(false); }
  };

  const allTeeth    = [...upperTeeth, ...lowerTeeth];
  const filledTeeth = allTeeth.filter(n => {
    const r = toothRecords.get(n);
    return r && (r.conditions.length > 0 || r.surfaces.length > 0 || r.examination || r.diagnosisText);
  });

  const perioPropArgs = { records: perioRecords, onUpdate: updatePerio };

  const TABS: { id: TabId; label: string }[] = [
    { id: "chart",   label: "Tooth Chart" },
    { id: "perio",   label: "Periodontal" },
    { id: "details", label: "Dental Details" },
    { id: "history", label: "Dental History" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full border border-border rounded-lg bg-card">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/40 rounded-t-lg">
        <div className="flex gap-0.5">
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {label}
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

      {/* Pre-fill banner — only shown when this encounter has no saved chart yet
          and the data was copied forward from a previous visit. Disappears once
          the doctor saves, which creates a real chart for this encounter. */}
      {!isLoading && preFillDate && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
          <span className="shrink-0 text-base">⚕</span>
          <span>
            <strong>Pre-filled from previous visit</strong> ({new Date(preFillDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}).
            Review the chart and click <strong>Save Chart</strong> to record findings for this visit.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading chart…
        </div>
      ) : (
        <>
          {/* ════════════════ TOOTH CHART TAB ════════════════ */}
          {tab === "chart" && (
            <div className="p-4">
              <div className="overflow-x-auto">
                <div className="flex gap-4 w-fit mx-auto items-stretch">

                  {/* ── Left legend sidebar ── */}
                  <div className="flex flex-col items-start justify-center gap-3 shrink-0 pr-3 border-r border-border/40">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0" />
                      <span>BOP positive</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-border shrink-0" />
                      <span>BOP negative</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/50 leading-tight mt-1">
                      Click a tooth<br />to open<br />case sheet
                    </div>
                  </div>

                  {/* ── Chart ── */}
                  <div className="flex flex-col items-start gap-0">

                  {/* ── UPPER ARCH ── */}
                  <ArchLabel label="Upper" teeth={upperTeeth} TOOTH_W={TOOTH_W} />
                  <ArchRow
                    teeth={upperTeeth} isUpper
                    selectedTooth={selectedTooth}
                    toothRecords={toothRecords}
                    perioRecords={perioRecords}
                    onToothClick={handleToothClick}
                    onBopChange={handleBopChange}
                    TOOTH_W={TOOTH_W}
                  />

                  {/* ── MIDLINE ── */}
                  <div style={{ height: 8 }} />
                  <div className="flex items-center w-full" style={{ minWidth: upperTeeth.length * TOOTH_W + 12 }}>
                    <div className="flex-1 h-0.5 bg-border/40" />
                    <span className="text-[9px] font-semibold text-muted-foreground/60 tracking-widest uppercase px-2">Midline</span>
                    <div className="flex-1 h-0.5 bg-border/40" />
                  </div>
                  <div style={{ height: 8 }} />

                  {/* ── LOWER ARCH ── */}
                  <ArchRow
                    teeth={lowerTeeth} isUpper={false}
                    selectedTooth={selectedTooth}
                    toothRecords={toothRecords}
                    perioRecords={perioRecords}
                    onToothClick={handleToothClick}
                    onBopChange={handleBopChange}
                    TOOTH_W={TOOTH_W}
                  />
                  <ArchLabel label="Lower" teeth={lowerTeeth} TOOTH_W={TOOTH_W} />

                  </div>{/* end chart column */}
                </div>{/* end flex gap-4 */}
              </div>

              {/* ── Inline case sheet when tooth selected ── */}
              {selectedTooth && (
                <div className="mt-4 border border-border rounded-lg bg-background relative">
                  <button type="button" onClick={() => setSelectedTooth(null)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors z-10">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mt-4 border-t border-border">
                {([
                  ["General Notes",         generalNotes,         setGeneralNotes],
                  ["Occlusion Notes",       occlusionNotes,       setOcclusionNotes],
                  ["Soft Tissue Notes",     softTissueNotes,      setSoftTissueNotes],
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

          {/* ════════════════ PERIODONTAL TAB ════════════════ */}
          {tab === "perio" && (
            <div className="overflow-x-auto">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-3 pl-[84px]">
                3-site measurements per tooth (MB · B · DB). Values ≥ 4 mm highlighted in red.
              </p>

              {/* ── UPPER ARCH ── */}
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-2 mb-2 pl-[84px]">
                Upper — Buccal
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={upperTeeth} field="buccalProbing"   label="Probing"   {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="buccalBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="buccalRecession" label="Recession" {...perioPropArgs} />
              </div>

              <PerioToothNumbers teeth={upperTeeth} />

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pl-[84px]">
                Upper — Lingual / Palatal
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={upperTeeth} field="lingualRecession" label="Recession" {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="lingualBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="lingualProbing"   label="Probing"   {...perioPropArgs} />
              </div>

              {/* ── SEPARATOR ── */}
              <div className="border-t-2 border-border my-6" />

              {/* ── LOWER ARCH ── */}
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pl-[84px]">
                Lower — Lingual
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={lowerTeeth} field="lingualProbing"   label="Probing"   {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="lingualBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="lingualRecession" label="Recession" {...perioPropArgs} />
              </div>

              <PerioToothNumbers teeth={lowerTeeth} />

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pl-[84px]">
                Lower — Buccal
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={lowerTeeth} field="buccalRecession" label="Recession" {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="buccalBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="buccalProbing"   label="Probing"   {...perioPropArgs} />
              </div>
            </div>
            </div>
          )}

          {/* ════════════════ DENTAL DETAILS TAB ════════════════ */}
          {tab === "details" && (
            <div className="p-4">
              {filledTeeth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tooth findings recorded yet. Click a tooth in the chart to add details.
                </p>
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
