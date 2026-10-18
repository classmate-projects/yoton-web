"use client";

import { Footprints, Stethoscope } from "lucide-react";

// The two patient streams every department works from: orders from a consultation in this
// facility, and walk-ins with an outside prescription/request (no visit behind them).
export type PatientStream = "consultation" | "walkIn";

interface Props {
  value: PatientStream;
  onChange: (value: PatientStream) => void;
  consultationCount: number;
  walkInCount: number;
  consultationLabel?: string;
  walkInLabel?: string;
}

export default function PatientStreamTabs({
  value,
  onChange,
  consultationCount,
  walkInCount,
  consultationLabel = "Consultation patients",
  walkInLabel = "Walk-in patients",
}: Props) {
  const tabs = [
    { key: "consultation" as const, label: consultationLabel, count: consultationCount, Icon: Stethoscope },
    { key: "walkIn" as const, label: walkInLabel, count: walkInCount, Icon: Footprints },
  ];

  return (
    <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
      {tabs.map(({ key, label, count, Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} className={active ? "text-primary" : ""} />
            {label}
            <span
              className={`rounded-full px-1.5 text-xs font-bold leading-5 ${
                active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
