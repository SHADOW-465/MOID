"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PERSONA,
  PERSONAS,
  readStoredPersona,
  writeStoredPersona,
  type PersonaCapabilities,
  type PersonaId,
} from "@/lib/persona";

type PersonaCtx = {
  persona: PersonaId;
  setPersona: (id: PersonaId) => void;
  capabilities: PersonaCapabilities;
  canWrite: boolean;
  canApprove: boolean;
  canConfigure: boolean;
};

const Ctx = createContext<PersonaCtx | null>(null);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<PersonaId>(DEFAULT_PERSONA);

  useEffect(() => {
    setPersonaState(readStoredPersona());
  }, []);

  const setPersona = useCallback((id: PersonaId) => {
    setPersonaState(id);
    writeStoredPersona(id);
  }, []);

  const value = useMemo<PersonaCtx>(() => {
    const capabilities = PERSONAS[persona].capabilities;
    return {
      persona,
      setPersona,
      capabilities,
      canWrite: capabilities.write,
      canApprove: capabilities.approve,
      canConfigure: capabilities.configure,
    };
  }, [persona, setPersona]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePersona(): PersonaCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback when a page is rendered outside the provider (tests).
    const capabilities = PERSONAS[DEFAULT_PERSONA].capabilities;
    return {
      persona: DEFAULT_PERSONA,
      setPersona: () => {},
      capabilities,
      canWrite: capabilities.write,
      canApprove: capabilities.approve,
      canConfigure: capabilities.configure,
    };
  }
  return v;
}
