"use client";

import { useState } from "react";

export interface TrendChartPoint {
  label: string;
  fullLabel: string;
  value: number;
}

interface TrendChartProps {
  data: TrendChartPoint[];
  color: string;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
}

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
};

// Single-series line/point chart — a sibling to BarChart.tsx following the same
// dependency-free, accessible convention (local-state hover tooltips, role="img"). Kept to
// one series at a time rather than plotting several vitals together: heart rate, O2 sat,
// and temperature sit on wildly different numeric scales, so a shared axis would make at
// least one of them look meaningless — the page picks which single vital to show instead.
export default function TrendChart({ data, color, formatValue = (v) => v.toLocaleString(), emptyMessage = "No data yet" }: TrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const dataMax = Math.max(...values);
  const dataMin = Math.min(0, ...values);
  const max = niceMax(dataMax);
  const ticks = [0, 0.33, 0.66, 1].map((f) => Math.round(max * f));

  const toY = (value: number) => 100 - Math.max(0, Math.min(100, ((value - dataMin) / (max - dataMin || 1)) * 100));
  const toX = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);

  const pathPoints = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");

  return (
    <div className="relative h-56 flex gap-3">
      {/* Y-axis */}
      <div className="flex flex-col justify-between text-right text-xs text-muted-foreground pb-6 shrink-0 w-10">
        {[...ticks].reverse().map((t, i) => (
          <span key={i} className="tabular-nums">{t.toLocaleString()}</span>
        ))}
      </div>

      {/* Plot area */}
      <div className="relative flex-1">
        {/* Gridlines */}
        <div className="absolute inset-0 bottom-6 flex flex-col justify-between pointer-events-none">
          {ticks.map((_, i) => (
            <div key={i} className="border-t border-border/60" />
          ))}
        </div>

        <div className="relative h-[calc(100%-1.5rem)]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <polyline points={pathPoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>

          {data.map((d, i) => {
            const isActive = activeIndex === i;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${toX(i)}%`, top: `${toY(d.value)}%` }}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex(null)}
                tabIndex={0}
                role="img"
                aria-label={`${d.fullLabel}: ${formatValue(d.value)}`}
              >
                {isActive && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 shadow-lg text-xs">
                    <p className="font-bold text-foreground tabular-nums">{formatValue(d.value)}</p>
                    <p className="text-muted-foreground">{d.fullLabel}</p>
                  </div>
                )}
                <div
                  className="h-2.5 w-2.5 rounded-full border-2 border-card transition-transform duration-150"
                  style={{ backgroundColor: color, transform: isActive ? "scale(1.4)" : "scale(1)" }}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between pt-1">
          {data.map((d, i) => (
            <span key={i} className="text-[11px] text-muted-foreground truncate" style={{ maxWidth: `${100 / data.length}%` }}>
              {i === 0 || i === data.length - 1 || data.length <= 6 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
