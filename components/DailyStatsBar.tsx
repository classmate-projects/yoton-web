"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, CheckCircle2 } from "lucide-react";
import { getUserDetail } from "@/lib/userDetail";
import { ReceptionService } from "@/services/reception.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { VisitType } from "@/types/visit.type";

function waitingDuration(checkedInAt: string): string {
  const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function PatientListPopup({
  anchorRef,
  title,
  patients,
  showDuration,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  patients: VisitType[];
  showDuration: boolean;
  onClose: () => void;
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: rect.left });
  }, [anchorRef]);

  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!coords || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed z-[9999] w-72 rounded-xl border border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-900 shadow-2xl overflow-hidden"
      style={{ top: coords.top, left: coords.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-gray-700">
        <p className="text-xs font-semibold text-white">{title}</p>
      </div>
      {patients.length === 0 ? (
        <p className="px-3 py-3 text-xs text-gray-300">No patients</p>
      ) : (
        <ul className="divide-y divide-gray-700 max-h-72 overflow-y-auto">
          {patients.slice(0, 10).map((p) => (
            <li key={p.visitId} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{p.patientName ?? "Unknown"}</p>
                <p className="text-[11px] text-gray-300 truncate">{p.status}</p>
              </div>
              {showDuration && (
                <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  {waitingDuration(p.checkedInAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {patients.length > 10 && (
        <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-700">
          +{patients.length - 10} more
        </p>
      )}
    </div>,
    document.body
  );
}

export default function DailyStatsBar({ variant = "bar" }: { variant?: "bar" | "inline" }) {
  const [visible, setVisible] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [completedToday, setCompletedToday] = useState<number | null>(null);
  const [queue, setQueue] = useState<VisitType[]>([]);
  const [activePopup, setActivePopup] = useState<"waiting" | "consulted" | null>(null);
  const [isFetchingQueue, setIsFetchingQueue] = useState(false);

  const waitingRef = useRef<HTMLDivElement>(null);
  const consultedRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async () => {
    try {
      const result = await ReceptionService.getDailyVisitStats();
      setWaiting(result.waiting);
      setCompletedToday(result.completedToday);
    } catch {
      // silently ignore — stats bar is informational
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    if (isFetchingQueue || queue.length > 0) return;
    try {
      setIsFetchingQueue(true);
      const result = await ReceptionService.getVisitQueue();
      setQueue(result.data ?? []);
    } catch {
      // ignore
    } finally {
      setIsFetchingQueue(false);
    }
  }, [isFetchingQueue, queue.length]);

  useEffect(() => {
    const detail = getUserDetail();
    if (detail) {
      setVisible(true);
      fetchStats();
    }
  }, [fetchStats]);

  useSignalRRefetch(["visitCheckedIn", "visitStatusUpdated"], () => {
    fetchStats();
    setQueue([]); // reset so queue is re-fetched on next hover
  });

  const handleMouseEnter = (type: "waiting" | "consulted") => {
    setActivePopup(type);
    fetchQueue();
  };

  const handleMouseLeave = () => {
    setActivePopup(null);
  };

  if (!visible) return null;

  const waitingPatients = queue.filter((v) => v.status !== "Completed");
  const consultedPatients = queue.filter((v) => v.status === "Completed");

  const anchorRef = activePopup === "waiting" ? waitingRef : consultedRef;

  if (variant === "inline") {
    return (
      <>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground font-medium text-[10px] uppercase tracking-wide hidden sm:block">
            Today
          </span>
          <div
            ref={waitingRef}
            className="flex items-center gap-1 text-amber-600 dark:text-amber-400 cursor-pointer select-none"
            onMouseEnter={() => handleMouseEnter("waiting")}
            onMouseLeave={handleMouseLeave}
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="font-semibold text-xs">{waiting === null ? "—" : waiting}</span>
            <span className="text-muted-foreground text-xs hidden sm:inline">waiting</span>
          </div>
          <div
            ref={consultedRef}
            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 cursor-pointer select-none"
            onMouseEnter={() => handleMouseEnter("consulted")}
            onMouseLeave={handleMouseLeave}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-semibold text-xs">{completedToday === null ? "—" : completedToday}</span>
            <span className="text-muted-foreground text-xs hidden sm:inline">consulted</span>
          </div>
        </div>

        {activePopup && (
          <PatientListPopup
            anchorRef={anchorRef}
            title={activePopup === "waiting" ? "Currently Waiting" : "Consulted Today"}
            patients={activePopup === "waiting" ? waitingPatients : consultedPatients}
            showDuration={activePopup === "waiting"}
            onClose={() => setActivePopup(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-6 border-b border-border bg-muted/40 px-4 py-1.5 text-sm">
        <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Today</span>
        <div
          ref={waitingRef}
          className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 cursor-pointer select-none"
          onMouseEnter={() => handleMouseEnter("waiting")}
          onMouseLeave={handleMouseLeave}
        >
          <Clock className="h-4 w-4" />
          <span className="font-semibold">{waiting === null ? "—" : waiting}</span>
          <span className="text-muted-foreground">waiting</span>
        </div>
        <div
          ref={consultedRef}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 cursor-pointer select-none"
          onMouseEnter={() => handleMouseEnter("consulted")}
          onMouseLeave={handleMouseLeave}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-semibold">{completedToday === null ? "—" : completedToday}</span>
          <span className="text-muted-foreground">consulted</span>
        </div>
      </div>

      {activePopup && (
        <PatientListPopup
          anchorRef={anchorRef}
          title={activePopup === "waiting" ? "Currently Waiting" : "Consulted Today"}
          patients={activePopup === "waiting" ? waitingPatients : consultedPatients}
          showDuration={activePopup === "waiting"}
          onClose={() => setActivePopup(null)}
        />
      )}
    </>
  );
}
