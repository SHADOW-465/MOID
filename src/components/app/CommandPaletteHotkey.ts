"use client";

import { useEffect } from "react";

/** Global ⌘K / Ctrl+K listener — kept separate from CommandPalette so AppShell
 *  can register the hotkey without pulling the palette JS until first open. */
export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
