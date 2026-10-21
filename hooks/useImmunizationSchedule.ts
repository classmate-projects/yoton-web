import { useEffect, useState } from "react";
import { ImmunizationService } from "@/services/immunization.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import type { ImmunizationScheduleType } from "@/types/immunization.type";

// One patient's Pediatric Immunization Schedule, kept live over SignalR - for the chart's
// entry points (the doctor's button badge, the nurse's Immunizations card). Only fetched
// when enabled, i.e. the patient is pediatric or already has a record.
export function useImmunizationSchedule(patientId: string | null | undefined, enabled: boolean) {
  const [schedule, setSchedule] = useState<ImmunizationScheduleType | null>(null);

  const reload = async () => {
    if (!patientId || !enabled) {
      setSchedule(null);
      return;
    }
    try {
      const res = await ImmunizationService.getSchedule(patientId);
      setSchedule(res.data ?? null);
    } catch {
      setSchedule(null);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, enabled]);

  useSignalRRefetch(["immunizationOrderChanged", "immunizationRemindersUpdated", "vaccineMasterUpdated"], () => {
    if (patientId && enabled) void reload();
  });

  return { schedule, reload };
}
