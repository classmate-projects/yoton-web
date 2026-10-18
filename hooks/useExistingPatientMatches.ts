import { useEffect, useRef, useState } from "react";
import { ReceptionService } from "@/services/reception.service";
import type { PatientMatchPayload, PatientMatchType } from "@/types/patient.type";

const looksLikeEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

// Live "is this person already registered?" lookup for registration forms. Only identifiers
// that look complete are sent (the API decides which ones count - see Settings > Duplicate
// patient check), and a dismissed set of matches stays hidden until a different patient
// turns up.
export function useExistingPatientMatches(input: PatientMatchPayload & { enabled?: boolean }) {
  const { nationalID, passportNumber, phone, phoneCode, email, excludePatientId, enabled = true } = input;
  const [matches, setMatches] = useState<PatientMatchType[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const nid = (nationalID ?? "").trim();
    const passport = (passportNumber ?? "").trim();
    const mobile = (phone ?? "").trim();
    const mail = (email ?? "").trim();
    const payload: PatientMatchPayload = {
      nationalID: nid.length >= 6 ? nid : undefined,
      passportNumber: passport.length >= 6 ? passport : undefined,
      phone: mobile.length >= 7 ? mobile : undefined,
      phoneCode: mobile.length >= 7 ? phoneCode : undefined,
      email: looksLikeEmail(mail) ? mail : undefined,
      excludePatientId,
    };
    const id = ++seq.current;
    if (!enabled || (!payload.nationalID && !payload.passportNumber && !payload.phone && !payload.email)) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await ReceptionService.matchPatients(payload);
        if (id === seq.current) setMatches(res.data ?? []);
      } catch {
        // Only a hint - registration itself still enforces unique IDs on the server.
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [nationalID, passportNumber, phone, phoneCode, email, excludePatientId, enabled]);

  const hasUndismissed = matches.some((m) => !dismissedIds.includes(m.opId));
  return {
    matches,
    visibleMatches: hasUndismissed ? matches : [],
    dismiss: () => setDismissedIds(matches.map((m) => m.opId)),
  };
}
