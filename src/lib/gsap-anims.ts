/**
 * gsap-anims.ts
 * Reusable GSAP animation hooks and utilities for MO!D Obsidian Glass.
 *
 * Includes:
 *  - useCountUp()     — animates a numeric value from 0 → target (odometer effect)
 *  - useStaggerIn()   — staggers a group of elements in with fade+rise
 *  - useDrawSVG()     — draws SVG path via strokeDashoffset on mount
 *  - pulseGlow()      — one-shot glow pulse on an element
 */
"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// ─────────────────────────────────────────────────────────────────────────────
// CountUp hook — animates numeric text content from 0 → target
// ─────────────────────────────────────────────────────────────────────────────

interface CountUpOptions {
  /** Final numeric value to count to */
  value: number;
  /** Duration in seconds (default: 1.6) */
  duration?: number;
  /** Number of decimal places to display (default: 0) */
  decimals?: number;
  /** Prefix inserted before the number (e.g., "₹", "$") */
  prefix?: string;
  /** Suffix appended after the number (e.g., "%", "K") */
  suffix?: string;
  /** Delay before animation starts (default: 0) */
  delay?: number;
  /** GSAP ease string (default: "power3.out") */
  ease?: string;
  /** Format fn override — if provided, prefix/suffix/decimals are ignored */
  format?: (n: number) => string;
}

/**
 * Returns a ref to attach to the element that will display the animated number.
 * Re-runs the animation whenever `value` changes.
 *
 * @example
 * const ref = useCountUp({ value: 94.3, decimals: 1, suffix: "%" });
 * return <span ref={ref} />;
 */
export function useCountUp({
  value,
  duration = 1.6,
  decimals = 0,
  prefix = "",
  suffix = "",
  delay = 0,
  ease = "power3.out",
  format,
}: CountUpOptions) {
  const ref = useRef<HTMLElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Kill any in-progress animation before starting a new one
    tweenRef.current?.kill();

    const counter = { n: 0 };
    tweenRef.current = gsap.to(counter, {
      n: value,
      duration,
      delay,
      ease,
      onUpdate() {
        if (!el) return;
        el.textContent = format
          ? format(counter.n)
          : `${prefix}${counter.n.toFixed(decimals)}${suffix}`;
      },
      onComplete() {
        if (!el) return;
        // Snap to exact final value to avoid floating point drift
        el.textContent = format
          ? format(value)
          : `${prefix}${value.toFixed(decimals)}${suffix}`;
      },
    });

    return () => { tweenRef.current?.kill(); };
  }, [value, duration, decimals, prefix, suffix, delay, ease, format]);

  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// StaggerIn hook — fades + slides up a list of children on mount
// ─────────────────────────────────────────────────────────────────────────────

interface StaggerInOptions {
  /** Distance to slide from (default: 24px) */
  y?: number;
  /** Stagger between each child (default: 0.06s) */
  stagger?: number;
  /** Duration per item (default: 0.55s) */
  duration?: number;
  /** Initial delay before first item (default: 0.05s) */
  delay?: number;
  /** CSS selector for children (default: ":scope > *") */
  selector?: string;
}

/**
 * Returns a ref to attach to the container element. On mount, each child
 * animates in with a staggered fade + rise.
 *
 * @example
 * const gridRef = useStaggerIn();
 * return <div ref={gridRef}>{cards}</div>;
 */
export function useStaggerIn({
  y = 24,
  stagger = 0.06,
  duration = 0.55,
  delay = 0.05,
  selector = ":scope > *",
}: StaggerInOptions = {}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const children = Array.from(container.querySelectorAll(selector));
    if (children.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.from(children, {
        y,
        opacity: 0,
        stagger,
        duration,
        delay,
        ease: "power2.out",
        clearProps: "all",
      });
    }, container);

    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref as React.RefObject<HTMLDivElement>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DrawSVG hook — reveals an SVG <path> via strokeDashoffset on mount
// ─────────────────────────────────────────────────────────────────────────────

interface DrawSVGOptions {
  /** Duration of the draw animation (default: 1.4s) */
  duration?: number;
  /** Delay before starting (default: 0.1s) */
  delay?: number;
  /** GSAP ease (default: "power2.out") */
  ease?: string;
}

/**
 * Returns a ref to attach to an SVG <path> element. On mount the path
 * is hidden (strokeDashoffset = pathLength) and then drawn left-to-right.
 *
 * @example
 * const pathRef = useDrawSVG({ duration: 1.2 });
 * return <path ref={pathRef} d={d} stroke="var(--accent)" />;
 */
export function useDrawSVG({
  duration = 1.4,
  delay = 0.1,
  ease = "power2.out",
}: DrawSVGOptions = {}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = ref.current;
    if (!path) return;

    const len = path.getTotalLength?.() ?? 0;
    if (len === 0) return;

    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration,
      delay,
      ease,
    });

    return () => { tween.kill(); };
  }, [duration, delay, ease]);

  return ref as React.RefObject<SVGPathElement>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pulse glow — one-shot accent glow flash on a DOM element
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call this after a data update to briefly flash an element with a glow.
 * @param el  - Target DOM element
 * @param color - Glow color (default: var(--accent-glow))
 */
export function pulseGlow(el: HTMLElement | null, color = "rgba(99,102,241,0.4)") {
  if (!el) return;
  gsap.timeline()
    .to(el, { boxShadow: `0 0 20px ${color}`, duration: 0.2, ease: "power2.out" })
    .to(el, { boxShadow: "none", duration: 0.6, ease: "power2.inOut" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fade-in utility — simple opacity 0 → 1 with optional Y offset
// ─────────────────────────────────────────────────────────────────────────────

export function useFadeIn(delay = 0) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tween = gsap.from(el, { opacity: 0, y: 10, duration: 0.5, delay, ease: "power2.out", clearProps: "all" });
    return () => { tween.kill(); };
  }, [delay]);

  return ref as React.RefObject<HTMLDivElement>;
}
