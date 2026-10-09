"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import type { IllustrationName } from "@/components/illustrations";

export interface BarChartPoint {
  label: string;
  fullLabel: string;
  value: number;
}

interface BarChartProps {
  data: BarChartPoint[];
  color: string;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
  emptyIllustration?: IllustrationName;
}

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
};

export default function BarChart({
  data,
  color,
  formatValue = (v) => v.toLocaleString(),
  emptyMessage = "No data yet",
  emptyIllustration = "chart",
}: BarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      // Same h-56 as the chart itself, so the card doesn't change height when data arrives.
      <div className="h-56 flex items-center justify-center">
        <EmptyState size="compact" illustration={emptyIllustration} title={emptyMessage} />
      </div>
    );
  }

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = [0, 0.33, 0.66, 1].map((f) => Math.round(max * f));

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

        {/* Bars */}
        <div className="relative h-full flex items-end gap-1 sm:gap-2 pb-6">
          {data.map((d, i) => {
            const heightPct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0);
            const isActive = activeIndex === i;
            return (
              <div
                key={i}
                className="relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer group"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex(null)}
                tabIndex={0}
                role="img"
                aria-label={`${d.fullLabel}: ${formatValue(d.value)}`}
              >
                {isActive && (
                  <div className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 shadow-lg text-xs">
                    <p className="font-bold text-foreground tabular-nums">{formatValue(d.value)}</p>
                    <p className="text-muted-foreground">{d.fullLabel}</p>
                  </div>
                )}
                <div
                  className="w-full max-w-6 rounded-t-[4px] transition-all duration-200"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: color,
                    opacity: isActive ? 1 : 0.75,
                  }}
                />
                <span className="absolute top-full mt-2 text-[11px] text-muted-foreground truncate max-w-full">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
