"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, CheckCircle2 } from "lucide-react";
import { getUserDetail } from "@/lib/userDetail";
import { ReceptionService } from "@/services/reception.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const STATS_MODULES = ["/doctor", "/nursing", "/lab", "/radiology", "/pharmacy", "/billing"];

export default function DailyStatsBar({ variant = "bar" }: { variant?: "bar" | "inline" }) {
  const [visible, setVisible] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [completedToday, setCompletedToday] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const result = await ReceptionService.getDailyVisitStats();
      setWaiting(result.waiting);
      setCompletedToday(result.completedToday);
    } catch {
      // silently ignore — stats bar is informational
    }
  }, []);

  useEffect(() => {
    const detail = getUserDetail();
    const modules: string[] = detail?.allowedModules ?? [];
    if (modules.some((m) => STATS_MODULES.includes(m))) {
      setVisible(true);
      fetchStats();
    }
  }, [fetchStats]);

  useSignalRRefetch(["visitCheckedIn", "visitStatusUpdated"], fetchStats);

  if (!visible) return null;

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground font-medium text-[10px] uppercase tracking-wide hidden sm:block">
          Today
        </span>
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-semibold text-xs">{waiting === null ? "—" : waiting}</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">waiting</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-semibold text-xs">{completedToday === null ? "—" : completedToday}</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">consulted</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 border-b border-border bg-muted/40 px-4 py-1.5 text-sm">
      <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
        Today
      </span>
      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
        <Clock className="h-4 w-4" />
        <span className="font-semibold">
          {waiting === null ? "—" : waiting}
        </span>
        <span className="text-muted-foreground">waiting</span>
      </div>
      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-semibold">
          {completedToday === null ? "—" : completedToday}
        </span>
        <span className="text-muted-foreground">consulted</span>
      </div>
    </div>
  );
}
