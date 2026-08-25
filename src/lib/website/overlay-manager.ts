/**
 * Shared header overlay manager.
 *
 * Only one major overlay (main menu, universal search panel, domain overlay,
 * mobile product launcher, welcome offer) may be open at a time. Components
 * register with a stable id and are closed automatically when another one
 * takes over.
 */
import { useCallback, useEffect, useState } from "react";

export type OverlayId =
  | "menu"
  | "search"
  | "domain"
  | "launcher"
  | "welcome"
  | "concierge";

let current: OverlayId | null = null;
const listeners = new Set<(id: OverlayId | null) => void>();

function emit() {
  for (const l of listeners) l(current);
}

export function openOverlay(id: OverlayId) {
  if (current === id) return;
  current = id;
  emit();
}

export function closeOverlay(id: OverlayId) {
  if (current !== id) return;
  current = null;
  emit();
}

/** Controlled open-state bound to the global mutual-exclusion manager. */
export function useExclusiveOverlay(id: OverlayId) {
  const [open, setOpenState] = useState(current === id);

  useEffect(() => {
    const listener = (next: OverlayId | null) => setOpenState(next === id);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (current === id) {
        current = null;
      }
    };
  }, [id]);

  const setOpen = useCallback(
    (next: boolean) => (next ? openOverlay(id) : closeOverlay(id)),
    [id],
  );
  const toggle = useCallback(
    () => (current === id ? closeOverlay(id) : openOverlay(id)),
    [id],
  );

  return { open, setOpen, toggle };
}
