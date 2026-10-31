"use client";

import type { ImmunizationStatus } from "@/types/immunization.type";
import { STATUS_ORDER, statusClass, statusLabel } from "./immunizationUi";

// "Given" reads better than "Administered" in a small box.
const chartLabel = (status: ImmunizationStatus) => (status === "Administered" ? "Given" : statusLabel(status));

// The immunization schedule as a chart, like a national vaccination card: one row per
// vaccine, one column per age milestone (Birth, 2 months, ... 4-6 years), and in each box the
// dose due at that age with its status colour and date. Clicking a box selects it - the
// screen using the chart shows that dose's details and actions underneath.

export interface ChartColumn {
  key: string;
  label: string;
  // Second header line, e.g. the recommended date for this patient.
  hint?: string | null;
}

export interface ChartRow {
  key: string;
  label: string;
  hint?: string | null;
}

export interface ChartCell {
  id: string;
  rowKey: string;
  colKey: string;
  // The dose ("Dose 2", "Booster", "Primary dose 3").
  title: string;
  status: ImmunizationStatus;
  // Date line under the status ("14 Dec 2026").
  detail?: string | null;
}

interface ImmunizationChartProps {
  columns: ChartColumn[];
  rows: ChartRow[];
  cells: ChartCell[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ImmunizationChart({ columns, rows, cells, selectedId, onSelect }: ImmunizationChartProps) {
  const byPosition = new Map<string, ChartCell[]>();
  for (const cell of cells) {
    const key = `${cell.rowKey}|${cell.colKey}`;
    const list = byPosition.get(key);
    if (list) list.push(cell);
    else byPosition.set(key, [cell]);
  }

  // A CSS grid rather than a <table>: the app's global table styles force large cell padding
  // (with !important) that the boxes can't afford. The vaccine column stays put while the
  // ages scroll sideways.
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div
        role="table"
        aria-label="Immunization chart"
        className="grid text-xs"
        style={{ gridTemplateColumns: `minmax(150px, 190px) repeat(${columns.length}, minmax(112px, 1fr))` }}
      >
        <div role="row" className="contents">
          <div role="columnheader" className="sticky left-0 z-10 flex items-end bg-muted px-3 py-2 font-semibold text-foreground">
            Vaccine
          </div>
          {columns.map((col) => (
            <div key={col.key} role="columnheader" className="flex flex-col justify-end border-l border-border bg-muted px-2 py-2 font-semibold text-foreground">
              {col.label}
              {col.hint && <span className="font-normal text-muted-foreground">{col.hint}</span>}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.key} role="row" className="contents">
            <div role="rowheader" className="sticky left-0 z-10 border-t border-border bg-card px-3 py-2 font-semibold text-foreground">
              {row.label}
              {row.hint && (
                <span className="block truncate font-normal text-muted-foreground" title={row.hint}>
                  {row.hint}
                </span>
              )}
            </div>
            {columns.map((col) => {
              const items = byPosition.get(`${row.key}|${col.key}`) ?? [];
              return (
                <div key={col.key} role="cell" className="flex flex-col gap-1 border-l border-t border-border p-1">
                  {items.map((item) => {
                    const selected = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-pressed={selected}
                        title={`${row.label} · ${item.title}: ${chartLabel(item.status)}${item.detail ? ` · ${item.detail}` : ""}`}
                        className={`w-full rounded-md px-2 py-1.5 text-left leading-snug transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusClass(item.status)} ${
                          selected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""
                        }`}
                      >
                        <span className="block font-semibold">{item.title}</span>
                        <span className="block">{chartLabel(item.status)}</span>
                        {item.detail && <span className="block whitespace-nowrap opacity-80">{item.detail}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Colour key for the statuses that actually appear in the chart.
export function ImmunizationChartLegend({ statuses }: { statuses: ImmunizationStatus[] }) {
  const present = STATUS_ORDER.filter((s) => statuses.includes(s));
  if (present.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {present.map((s) => (
        <span key={s} className={`rounded-full px-2 py-0.5 font-semibold ${statusClass(s)}`}>
          {chartLabel(s)}
        </span>
      ))}
    </div>
  );
}
