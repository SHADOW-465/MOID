"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { Event } from "@/lib/store/types";

interface EventsContextType {
  events: Event[] | null;
  isLoading: boolean;
  /** True while a background revalidate is in flight (UI already has data). */
  isValidating: boolean;
  refreshEvents: () => Promise<void>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

/**
 * Shared ledger cache for the shell.
 *
 * SWR-style: first load shows loading; later refreshes keep stale data on screen
 * (isValidating) so navigating / agent ingest / entry save never blank the UI.
 * One in-flight fetch is coalesced so concurrent refreshEvents() share a promise.
 */
export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const hasData = useRef(false);

  const refreshEvents = useCallback(async () => {
    if (inflight.current) return inflight.current;

    const run = (async () => {
      if (hasData.current) setIsValidating(true);
      else setIsLoading(true);
      try {
        const res = await fetch("/api/events", {
          // Browser may cache briefly; we still revalidate on focus/refresh.
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`events ${res.status}`);
        const data = await res.json();
        const next = (data.events ?? []) as Event[];
        setEvents(next);
        hasData.current = true;
      } catch (err) {
        console.error("Failed to fetch events:", err);
        // Keep previous events if we had them; only empty on first failure.
        setEvents((prev) => (prev != null ? prev : []));
        hasData.current = hasData.current || false;
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
    void refreshEvents();
  }, [refreshEvents]);

  // Revalidate when the tab becomes visible again (operator left for Excel, returned).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && hasData.current) {
        void refreshEvents();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshEvents]);

  const value = useMemo(
    () => ({ events, isLoading, isValidating, refreshEvents }),
    [events, isLoading, isValidating, refreshEvents],
  );

  return (
    <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return context;
}
