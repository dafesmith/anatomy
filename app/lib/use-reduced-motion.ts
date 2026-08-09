"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia(QUERY);
  // Listened to rather than read once, because it can be toggled mid-session from
  // the operating system while the page is open.
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

/**
 * Whether the reader has asked for less movement.
 *
 * Through `useSyncExternalStore` rather than an effect, so the value is right on
 * the first client render instead of one frame late — with a burst of confetti,
 * one frame late means it has already been seen. The server snapshot is `false`,
 * which is safe: nothing here animates during server rendering.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
