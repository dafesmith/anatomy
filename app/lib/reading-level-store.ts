"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./local-store";
import type { ReadingLevel } from "./kid-readings";

const STORAGE_KEY = "anatomy-atelier:reading-level:v1";
const LEVELS: ReadingLevel[] = ["simple", "standard", "original"];

/**
 * The chosen reading level, remembered between visits — a child shouldn't have to
 * find the control again every time the app opens.
 *
 * `standard` is the default: this is an app for children of about 7 to 12 and the
 * grown-ups reading with them, so an adult-worded first visit is the wrong way
 * round. It defaulted to `original`, which meant every lesson, every callout and
 * every read-aloud opened in clinical prose until somebody found the picker —
 * "A muscular organ that pumps blood throughout the body, delivering oxygen and
 * nutrients to every cell" rather than "Your heart is a pump made of muscle".
 *
 * `standard` (ages 10-12) rather than `simple` (7-9) because it is the middle of
 * the audience: plain enough for a ten-year-old, not condescending to an adult who
 * lands here, and one tap from either neighbour.
 *
 * Whatever it is, `DEFAULT_LEVEL` must be what `getServerSnapshot` returns as
 * well, or the server markup and the first client render disagree and React
 * discards the hydrated tree.
 */
const DEFAULT_LEVEL: ReadingLevel = "standard";
const listeners = new Set<() => void>();
let cached: ReadingLevel | null = null;

function readStored(): ReadingLevel {
  const stored = readLocal(STORAGE_KEY);
  return typeof stored === "string" && (LEVELS as string[]).includes(stored)
    ? (stored as ReadingLevel)
    : DEFAULT_LEVEL;
}

/** Must return a stable value per store state — a string compares by value, so
 *  caching it is enough to keep React from re-rendering on every check. */
function getSnapshot(): ReadingLevel {
  if (cached === null) cached = readStored();
  return cached;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` only fires in *other* tabs, so same-tab writes notify directly
  // below. This keeps a second tab in step as a bonus.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useReadingLevel() {
  const level = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LEVEL);

  const choose = useCallback((next: ReadingLevel) => {
    cached = next;
    writeLocal(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, []);

  return { level, choose };
}
