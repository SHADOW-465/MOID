"use client";

// The active Data Entry schema (registry) — the SAME /api/schema "no presetId"
// default the server itself falls back to, fetched once here so every
// analytics page shares one copy instead of independently calling
// DISPOSAFE_REGISTRY as a hardcoded default. Mirrors EventsContext exactly.
//
// Waits for auth session so signed-out shells
// do not log `schema 401`, and re-fetches immediately after sign-in.

import {
  DEFAULT_POLICY,
  parsePolicy,
  type CalculationPolicyT,
} from "@/core/policy/policy";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { usePersona } from "@/components/app/PersonaContext";

interface RegistryContextType {
  registry: any | null;
  /** Plant calculation policy — served by the same /api/schema call, so no
   *  second fetch and no second provider. Never null: falls back to the
   *  shipped defaults so screens never render under undefined conventions. */
  policy: CalculationPolicyT;
  isLoading: boolean;
  isValidating: boolean;
  refreshRegistry: () => Promise<void>;
}

const RegistryContext = createContext<RegistryContextType | undefined>(undefined);

export function RegistryProvider({ children }: { children: React.ReactNode }) {
  const { authEnabled, authUser, authReady } = usePersona();
  const [registry, setRegistry] = useState<any | null>(null);
  const [policy, setPolicy] = useState<CalculationPolicyT>(DEFAULT_POLICY);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const hasData = useRef(false);

  const blockedByAuth = authReady && authEnabled && !authUser;
  const canFetch = authReady && !blockedByAuth;

  const refreshRegistry = useCallback(async () => {
    if (!canFetch) {
      setRegistry(null);
      setPolicy(DEFAULT_POLICY);
      setIsLoading(false);
      setIsValidating(false);
      return;
    }
    if (inflight.current) return inflight.current;

    const run = (async () => {
      if (hasData.current) setIsValidating(true);
      else setIsLoading(true);
      try {
        const res = await fetch("/api/schema", { credentials: "same-origin" });
        if (res.status === 401) {
          // Signed out with auth on — expected; keep empty, no console noise.
          setRegistry(null);
          setPolicy(DEFAULT_POLICY);
          hasData.current = false;
          return;
        }
        if (!res.ok) throw new Error(`schema ${res.status}`);
        const data = await res.json();
        setRegistry(data.registry ?? null);
        setPolicy(parsePolicy(data.policy));
        hasData.current = true;
      } catch (err) {
        console.error("Failed to fetch active registry:", err);
        setRegistry((prev: any | null) => (prev != null ? prev : null));
      } finally {
        setIsLoading(false);
        setIsValidating(false);
        inflight.current = null;
      }
    })();

    inflight.current = run;
    return run;
  }, [canFetch]);

  useEffect(() => {
    if (!authReady) return;
    if (blockedByAuth) {
      setRegistry(null);
      setPolicy(DEFAULT_POLICY);
      hasData.current = false;
      setIsLoading(false);
      setIsValidating(false);
      return;
    }
    void refreshRegistry();
  }, [authReady, blockedByAuth, authUser?.username, refreshRegistry]);

  const value = useMemo(
    () => ({ registry, policy, isLoading, isValidating, refreshRegistry }),
    [registry, policy, isLoading, isValidating, refreshRegistry],
  );

  return (
    <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>
  );
}

export function useRegistry() {
  const context = useContext(RegistryContext);
  if (!context) {
    throw new Error("useRegistry must be used within a RegistryProvider");
  }
  return context;
}

/** Policy only — same object as useRegistry().policy for screens that do not need the catalog. */
export function usePolicy(): CalculationPolicyT {
  return useRegistry().policy;
}
