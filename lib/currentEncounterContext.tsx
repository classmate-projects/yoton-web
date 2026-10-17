"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type EncounterState = {
  patientId: string | null;
  encounterId: string | null;
  visitId: string | null;
  isCompleted: boolean;
  onRequestReopen: (() => void) | null;
};

type EncounterCtx = EncounterState & {
  setCurrentEncounter: (patientId: string | null, encounterId: string | null, visitId: string | null) => void;
  setReopenState: (isCompleted: boolean, callback: (() => void) | null) => void;
};

const Ctx = createContext<EncounterCtx>({
  patientId: null,
  encounterId: null,
  visitId: null,
  isCompleted: false,
  onRequestReopen: null,
  setCurrentEncounter: () => {},
  setReopenState: () => {},
});

export function CurrentEncounterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EncounterState>({
    patientId: null, encounterId: null, visitId: null, isCompleted: false, onRequestReopen: null,
  });

  const setCurrentEncounter = useCallback((patientId: string | null, encounterId: string | null, visitId: string | null) => {
    setState(s => ({ ...s, patientId, encounterId, visitId }));
  }, []);

  const setReopenState = useCallback((isCompleted: boolean, callback: (() => void) | null) => {
    setState(s => ({ ...s, isCompleted, onRequestReopen: callback }));
  }, []);

  return <Ctx.Provider value={{ ...state, setCurrentEncounter, setReopenState }}>{children}</Ctx.Provider>;
}

export function useCurrentEncounter() {
  return useContext(Ctx);
}
