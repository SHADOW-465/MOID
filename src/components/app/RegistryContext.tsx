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

export type RefreshRegistryOpts = { force?: boolean };

interface RegistryContextType {
  registry: any | null;
  /** Plant calculation policy — served by the same /api/schema call, so no
   *  second fetch and no second provider. Never null: falls back to the
   *  shipped defaults so screens never render under undefined conventions. */
  policy: CalculationPolicyT;
  isLoading: boolean;
  isValidating: boolean;
  /** `catalog.updatedAt` from the last successful /api/schema read. Data Entry
   *  refetches its template when this changes after a schema mutation. */
  schemaRev: string | null;
  configured: boolean;
  refreshRegistry: (opts?: RefreshRegistryOpts) => Promise<void>;
}

const RegistryContext = createContext<RegistryContextType | undefined>(undefined);

export function RegistryProvider({ children }: { children: React.ReactNode }) {
  const { authEnabled, authUser, authReady } = usePersona();
  const [registry, setRegistry] = useState<any | null>(null);
  const [policy, setPolicy] = useState<CalculationPolicyT>(DEFAULT_POLICY);
  const [schemaRev, setSchemaRev] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const inflightGen = useRef(0);
  const hasData = useRef(false);
  const fetchGen = useRef(0);

  const blockedByAuth = authReady && authEnabled && !authUser;
  const canFetch = authReady && !blockedByAuth;

  const refreshRegistry = useCallback(async (opts?: RefreshRegistryOpts) => {
    if (!canFetch) {
      setRegistry(null);
      setPolicy(DEFAULT_POLICY);
      setSchemaRev(null);
      setConfigured(false);
      setIsLoading(false);
      setIsValidating(false);
      return;
    }
    if (inflight.current && !opts?.force) return inflight.current;

    const myGen = ++fetchGen.current;
    inflightGen.current = myGen;
    const run = (async () => {
      if (hasData.current) setIsValidating(true);
      else setIsLoading(true);
      try {
        const res = await fetch("/api/schema", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (myGen !== fetchGen.current) return;
        if (res.status === 401) {
          // Signed out with auth on — expected; keep empty, no console noise.
          setRegistry(null);
          setPolicy(DEFAULT_POLICY);
          setSchemaRev(null);
          setConfigured(false);
          hasData.current = false;
          return;
        }
        if (!res.ok) throw new Error(`schema ${res.status}`);
        const data = await res.json();
        if (myGen !== fetchGen.current) return;
        setRegistry(data.registry ?? null);
        setPolicy(parsePolicy(data.policy));
        setSchemaRev(data.catalog?.updatedAt ?? data.catalog?.lastMergedFrom ?? null);
        setConfigured(!!data.configured);
        hasData.current = true;
      } catch (err) {
        if (myGen !== fetchGen.current) return;
        console.error("Failed to fetch active registry:", err);
        setRegistry((prev: any | null) => (prev != null ? prev : null));
      } finally {
        if (myGen === fetchGen.current) {
          setIsLoading(false);
          setIsValidating(false);
        }
        if (inflightGen.current === myGen) inflight.current = null;
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
      setSchemaRev(null);
      setConfigured(false);
      hasData.current = false;
      setIsLoading(false);
      setIsValidating(false);
      return;
    }
    void refreshRegistry();
  }, [authReady, blockedByAuth, authUser?.username, refreshRegistry]);

  const value = useMemo(
    () => ({
      registry,
      policy,
      isLoading,
      isValidating,
      schemaRev,
      configured,
      refreshRegistry,
    }),
    [registry, policy, isLoading, isValidating, schemaRev, configured, refreshRegistry],
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
