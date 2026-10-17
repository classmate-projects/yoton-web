"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import type { IllustrationName } from "@/components/illustrations";
import type { BarChartPoint } from "@/components/BarChart";

// Same data shape and props as BarChart, so the two are interchangeable.
export type LineChartPoint = BarChartPoint;

interface LineChartProps {
  data: LineChartPoint[];
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

// Single-series line chart: 2px line over a ~10% area wash, hairline grid, an end-dot on
// the latest point, and a crosshair + tooltip that snaps to the nearest day on hover/focus.
// Points sit at the centre of equal-width columns (same x positions as BarChart's bars),
// and those columns double as the hover/focus hit targets.
export default function LineChart({
  data,
  color,
  formatValue = (v) => v.toLocaleString(),
  emptyMessage = "No data yet",
  emptyIllustration = "chart",
}: LineChartProps) {
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

  // Plot coordinates in a 0-100 box (x = column centre, y = 0 at top).
  const points = data.map((d, i) => ({
    x: ((i + 0.5) / data.length) * 100,
    y: 100 - (d.value / max) * 100,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},100 L${points[0].x},100 Z`;

  const lastIndex = data.length - 1;
  const markerIndex = activeIndex ?? lastIndex;
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="relative h-56 flex gap-3">
      {/* Y-axis */}
      <div className="flex flex-col justify-between text-right text-xs text-muted-foreground pb-6 shrink-0 w-14">
        {[...ticks].reverse().map((t, i) => (
          <span key={i} className="tabular-nums">{t.toLocaleString()}</span>
        ))}
      </div>

      {/* Plot area */}
      <div className="relative flex-1">
        <div className="absolute inset-0 bottom-6">
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-border/60" />
            ))}
          </div>

          {/* Area + line. preserveAspectRatio="none" stretches the 0-100 box to fit;
              non-scaling-stroke keeps the line a true 2px whatever the stretch. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible pointer-events-none"
            aria-hidden="true"
          >
            <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Crosshair */}
          {activeIndex !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-muted-foreground/40 pointer-events-none"
              style={{ left: `${points[activeIndex].x}%` }}
            />
          )}

          {/* Marker: hovered point, otherwise the latest one. HTML (not SVG) so it stays a
              true circle - 8px dot with a 2px ring in the card colour. */}
          <div
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card pointer-events-none"
            style={{
              left: `${points[markerIndex].x}%`,
              top: `${points[markerIndex].y}%`,
              backgroundColor: color,
            }}
          />

          {/* Tooltip - text in text tokens, never the series colour */}
          {active && activeIndex !== null && (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 shadow-lg text-xs pointer-events-none"
              style={{
                left: `${Math.min(Math.max(points[activeIndex].x, 12), 88)}%`,
                top: `calc(${points[activeIndex].y}% - 12px)`,
              }}
            >
              <p className="font-bold text-foreground tabular-nums">{formatValue(active.value)}</p>
              <p className="text-muted-foreground">{active.fullLabel}</p>
            </div>
          )}
        </div>

        {/* Hit targets (one full-height column per point) + x-axis labels */}
        <div className="relative h-full flex">
          {data.map((d, i) => (
            <div
              key={i}
              className="relative flex-1 h-full cursor-pointer outline-none"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              tabIndex={0}
              role="img"
              aria-label={`${d.fullLabel}: ${formatValue(d.value)}`}
            >
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground truncate max-w-full">
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
