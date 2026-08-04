"use client";

// What "what is this graph?" and "highlight it" answer against.
//
// FloatingDetailModal is the one place a KPI or chart's verified numbers
// (checked/accepted/rejected/rework, top driver) already get computed, on
// every one of the 8 pages that use it. Rather than thread that state through
// 8 pages into the agent, the modal publishes here on open/close — one choke
// point instead of eight call sites.
//
// The agent reads `metric` (plain data — safe to hand to the pure reducer).
// The rect stays client-side only, for the spotlight overlay below.

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ActiveMetricSnapshot } from "@/lib/agent/types";

interface Ctx {
  metric: ActiveMetricSnapshot | null;
  setMetric: (m: ActiveMetricSnapshot | null, rect?: DOMRect | null) => void;
  /** Pulse a ring over the card the current metric came from. No-op if none is open. */
  pulse: () => void;
}

const ActiveMetricCtx = createContext<Ctx | null>(null);

export function ActiveMetricProvider({ children }: { children: React.ReactNode }) {
  const [metric, setMetricState] = useState<ActiveMetricSnapshot | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMetric = useCallback((m: ActiveMetricSnapshot | null, rect?: DOMRect | null) => {
    setMetricState(m);
    rectRef.current = rect ?? null;
  }, []);

  const pulse = useCallback(() => {
    if (!rectRef.current) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setSpotlightRect(rectRef.current);
    clearTimer.current = setTimeout(() => setSpotlightRect(null), 1600);
  }, []);

  return (
    <ActiveMetricCtx.Provider value={{ metric, setMetric, pulse }}>
      {children}
      {spotlightRect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: spotlightRect.left - 6,
            top: spotlightRect.top - 6,
            width: spotlightRect.width + 12,
            height: spotlightRect.height + 12,
            borderRadius: "var(--radius-lg)",
            border: "2px solid var(--accent)",
            boxShadow: "0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent)",
            pointerEvents: "none",
            zIndex: 1200,
            animation: "pulse-ring 0.8s ease-out 2",
          }}
        />
      )}
    </ActiveMetricCtx.Provider>
  );
}

export function useActiveMetric(): Ctx {
  const ctx = useContext(ActiveMetricCtx);
  if (!ctx) {
    // Safe fallback outside the provider (tests, storybook-style renders).
    return { metric: null, setMetric: () => {}, pulse: () => {} };
  }
  return ctx;
}
