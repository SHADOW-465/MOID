"use client";

// The active Data Entry schema (registry) — the SAME /api/schema "no presetId"
// default the server itself falls back to, fetched once here so every
// analytics page shares one copy instead of independently calling
// DISPOSAFE_REGISTRY as a hardcoded default. Mirrors EventsContext exactly.
//
// This is the fix for the root cause traced in this session: rejectionRate(),
// totalChecked(), fpy(), byStage(), byDefect(), stageTrend(), stageBySize()
// (src/lib/analytics/rejection.ts, defect.ts) all default their `registry`
// parameter to the hardcoded DISPOSAFE_REGISTRY, and no page was passing a
// dynamic one in. perStageAgg() filters ledger events against registry.stages
// — any event whose stageId isn't one of the 13 hardcoded ones was silently
// invisible to every headline KPI, even though it was correctly stored in the
// canonical event ledger. Pages should pass `registry` from useRegistry() into
// every selector call instead of relying on the hardcoded default.

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
  const [registry, setRegistry] = useState<any | null>(null);
  const [policy, setPolicy] = useState<CalculationPolicyT>(DEFAULT_POLICY);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const hasData = useRef(false);

  const refreshRegistry = useCallback(async () => {
    if (inflight.current) return inflight.current;

    const run = (async () => {
      if (hasData.current) setIsValidating(true);
      else setIsLoading(true);
      try {
        const res = await fetch("/api/schema");
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
  }, []);

  useEffect(() => {
    void refreshRegistry();
  }, [refreshRegistry]);

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

/** The plant's calculation conventions. Same provider, no extra fetch. */
export function usePolicy(): CalculationPolicyT {
  return useRegistry().policy;
}
