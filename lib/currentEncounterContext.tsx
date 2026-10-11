"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type EncounterState = {
  patientId: string | null;
  encounterId: string | null;
  visitId: string | null;
};

type EncounterCtx = EncounterState & {
  setCurrentEncounter: (patientId: string | null, encounterId: string | null, visitId: string | null) => void;
};

const Ctx = createContext<EncounterCtx>({
  patientId: null,
  encounterId: null,
  visitId: null,
  setCurrentEncounter: () => {},
});

export function CurrentEncounterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EncounterState>({ patientId: null, encounterId: null, visitId: null });

  const setCurrentEncounter = (patientId: string | null, encounterId: string | null, visitId: string | null) => {
    setState({ patientId, encounterId, visitId });
  };

  return <Ctx.Provider value={{ ...state, setCurrentEncounter }}>{children}</Ctx.Provider>;
}

export function useCurrentEncounter() {
  return useContext(Ctx);
}
