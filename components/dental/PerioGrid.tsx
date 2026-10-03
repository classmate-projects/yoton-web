"use client";

import { PerioRecord } from "@/types/dental.type";

interface PerioGridProps {
  teeth: string[];            // ordered FDI numbers for this arch (e.g. 18→11 or 21→28)
  records: Map<string, PerioRecord>;
  onUpdate: (toothNumber: string, field: keyof PerioRecord, value: string) => void;
  arch: "upper" | "lower";
}

const SITES = ["MB", "B", "DB"] as const;
const ROWS: { label: string; buccalKey: keyof PerioRecord; lingualKey: keyof PerioRecord }[] = [
  { label: "Probing",   buccalKey: "buccalProbing",   lingualKey: "lingualProbing" },
  { label: "BOP",       buccalKey: "buccalBop",        lingualKey: "lingualBop" },
  { label: "Recession", buccalKey: "buccalRecession",  lingualKey: "lingualRecession" },
];

function parseValues(csv: string | undefined): [string, string, string] {
  const parts = (csv ?? "").split(",");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

function updateValue(csv: string | undefined, index: number, val: string): string {
  const parts = parseValues(csv);
  parts[index] = val;
  return parts.join(",");
}

function BopCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPositive = value === "1";
  return (
    <button
      type="button"
      onClick={() => onChange(isPositive ? "0" : "1")}
      className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${
        isPositive ? "bg-red-500 text-white border-red-600" : "bg-background border-border text-muted-foreground"
      }`}
      title={isPositive ? "BOP +" : "BOP -"}
    >
      {isPositive ? "+" : "-"}
    </button>
  );
}

function DepthCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-7 h-7 text-center text-xs border rounded p-0 ${
        Number(value) >= 4 ? "text-red-500 font-bold border-red-300" : "border-border"
      }`}
    />
  );
}

export default function PerioGrid({ teeth, records, onUpdate, arch }: PerioGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse" style={{ minWidth: `${teeth.length * 88 + 80}px` }}>
        <colgroup>
          <col style={{ width: 72 }} />
          {teeth.map(t => <col key={t} style={{ width: 88 }} />)}
        </colgroup>
        <tbody>
          {/* Tooth numbers row */}
          <tr>
            <td />
            {teeth.map(t => (
              <td key={t} className="text-center font-semibold text-red-500 pb-1">{t}</td>
            ))}
          </tr>

          {/* Buccal probing, BOP, Recession */}
          {ROWS.map(({ label, buccalKey }) => {
            const isBop = buccalKey === "buccalBop";
            return (
              <tr key={`buccal-${label}`} className="border-t border-border/40">
                <td className="pr-2 py-0.5 text-right text-muted-foreground whitespace-nowrap">
                  {arch === "upper" ? label : ""}{arch === "upper" ? "" : ""}
                  <span className="text-[10px] text-muted-foreground/60 block">{arch === "upper" ? "Buccal" : "Buccal"}</span>
                  {arch === "upper" && label}
                </td>
                {teeth.map(t => {
                  const rec = records.get(t);
                  const csv = rec?.[buccalKey] as string | undefined;
                  const vals = parseValues(csv);
                  return (
                    <td key={t} className="px-0.5 py-0.5">
                      <div className="flex gap-0.5 justify-center">
                        {SITES.map((_, idx) =>
                          isBop
                            ? <BopCell key={idx} value={vals[idx]} onChange={v => onUpdate(t, buccalKey, updateValue(csv, idx, v))} />
                            : <DepthCell key={idx} value={vals[idx]} onChange={v => onUpdate(t, buccalKey, updateValue(csv, idx, v))} />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* Lingual rows — mirrored order */}
          {[...ROWS].reverse().map(({ label, lingualKey }) => {
            const isBop = lingualKey === "lingualBop";
            return (
              <tr key={`lingual-${label}`} className="border-t border-border/40">
                <td className="pr-2 py-0.5 text-right text-muted-foreground whitespace-nowrap">
                  <span className="text-[10px] text-muted-foreground/60 block">Lingual</span>
                  {label}
                </td>
                {teeth.map(t => {
                  const rec = records.get(t);
                  const csv = rec?.[lingualKey] as string | undefined;
                  const vals = parseValues(csv);
                  return (
                    <td key={t} className="px-0.5 py-0.5">
                      <div className="flex gap-0.5 justify-center">
                        {SITES.map((_, idx) =>
                          isBop
                            ? <BopCell key={idx} value={vals[idx]} onChange={v => onUpdate(t, lingualKey, updateValue(csv, idx, v))} />
                            : <DepthCell key={idx} value={vals[idx]} onChange={v => onUpdate(t, lingualKey, updateValue(csv, idx, v))} />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
