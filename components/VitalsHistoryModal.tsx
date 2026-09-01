"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VitalsHistoryEntryType } from "@/types/nursing.type";

interface VitalsHistoryModalProps {
  entries: VitalsHistoryEntryType[]; // newest first, matches GetVitalsHistory's own ordering
  onClose: () => void;
}

// One independently-toggleable line per vital (see the checkbox row below) - key must be a
// field VitalsHistoryEntryType actually carries, so a line's data comes straight off the
// same entry objects passed in as chart points.
const VITAL_LINES: { key: keyof VitalsHistoryEntryType; label: string; color: string; unit: string }[] = [
  { key: "heartRate", label: "Heart Rate", color: "#ef4444", unit: "BPM" },
  { key: "systolic", label: "BP Systolic", color: "#3b82f6", unit: "mmHg" },
  { key: "diastolic", label: "BP Diastolic", color: "#6366f1", unit: "mmHg" },
  { key: "temperature", label: "Temperature", color: "#f59e0b", unit: "°C" },
  { key: "respiratory", label: "Respiratory", color: "#10b981", unit: "bpm" },
  { key: "oxygenSaturation", label: "O2 Saturation", color: "#06b6d4", unit: "%" },
  { key: "bloodSugar", label: "Blood Sugar", color: "#a855f7", unit: "mmol/L" },
  { key: "weightKg", label: "Weight", color: "#84cc16", unit: "kg" },
  { key: "bmi", label: "BMI", color: "#ec4899", unit: "kg/m2" },
];

// Below this many readings a trend line doesn't tell you anything a couple of numbers in the
// table below it don't already say faster - matches the explicit "more than 2" ask.
const MIN_READINGS_FOR_GRAPH = 2;

export default function VitalsHistoryModal({ entries, onClose }: VitalsHistoryModalProps) {
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(VITAL_LINES.map((v) => [v.key, true]))
  );

  const toggleLine = (key: string) =>
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));

  // Chronological (oldest -> newest) for the graph, so time reads left-to-right the way a
  // trend normally would - the table below stays newest-first, which reads more naturally
  // for "what's the latest reading" at a glance.
  const chartData = [...entries].reverse().map((e) => ({
    ...e,
    label: format(new Date(e.recordedAt), "d MMM, h:mm a"),
  }));

  const showGraph = entries.length > MIN_READINGS_FOR_GRAPH;
  // Only offer a checkbox for a vital with at least one real reading in this history - a
  // line with nothing to plot would just clutter the legend with an always-empty toggle.
  const linesWithData = VITAL_LINES.filter((line) => entries.some((e) => e[line.key] != null));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Vitals History</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No vitals recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {showGraph && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  {linesWithData.map((line) => (
                    <label
                      key={line.key}
                      className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={visibleLines[line.key] ?? true}
                        onChange={() => toggleLine(line.key)}
                        className="h-3.5 w-3.5 cursor-pointer"
                        style={{ accentColor: line.color }}
                      />
                      <span style={{ color: line.color }}>{line.label}</span>
                      <span className="text-muted-foreground">({line.unit})</span>
                    </label>
                  ))}
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {linesWithData
                        .filter((line) => visibleLines[line.key])
                        .map((line) => (
                          <Line
                            key={line.key}
                            type="monotone"
                            dataKey={line.key}
                            name={line.label}
                            stroke={line.color}
                            connectNulls
                            dot={{ r: 3 }}
                            isAnimationActive={false}
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">Source</th>
                    <th className="py-2 pr-3 font-semibold">HR</th>
                    <th className="py-2 pr-3 font-semibold">B.P</th>
                    <th className="py-2 pr-3 font-semibold">Temp</th>
                    <th className="py-2 pr-3 font-semibold">Resp</th>
                    <th className="py-2 pr-3 font-semibold">O2</th>
                    <th className="py-2 pr-3 font-semibold">Sugar</th>
                    <th className="py-2 pr-3 font-semibold">Wt / Ht / BMI</th>
                    <th className="py-2 pr-3 font-semibold">By</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-b border-border/50 text-foreground">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {format(new Date(e.recordedAt), "dd MMM yyyy, h:mm a")}
                      </td>
                      <td className="py-2 pr-3">{e.source}</td>
                      <td className="py-2 pr-3">{e.heartRate ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {e.systolic && e.diastolic ? `${e.systolic}/${e.diastolic}` : "—"}
                      </td>
                      <td className="py-2 pr-3">{e.temperature ?? "—"}</td>
                      <td className="py-2 pr-3">{e.respiratory ?? "—"}</td>
                      <td className="py-2 pr-3">{e.oxygenSaturation ?? "—"}</td>
                      <td className="py-2 pr-3">{e.bloodSugar ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {[
                          e.weightKg ? `${e.weightKg}kg` : null,
                          e.heightCm ? `${e.heightCm}cm` : null,
                          e.bmi ? `BMI ${e.bmi.toFixed(1)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </td>
                      <td className="py-2 pr-3">{e.recordedByName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
