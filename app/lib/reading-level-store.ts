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
 * `original` is the default, so a first-time visitor sees the atlas as written and
 * the server-rendered markup always matches the first client render.
 */
const listeners = new Set<() => void>();
let cached: ReadingLevel | null = null;

function readStored(): ReadingLevel {
  const stored = readLocal(STORAGE_KEY);
  return typeof stored === "string" && (LEVELS as string[]).includes(stored)
    ? (stored as ReadingLevel)
    : "original";
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
  const level = useSyncExternalStore(subscribe, getSnapshot, () => "original" as ReadingLevel);

  const choose = useCallback((next: ReadingLevel) => {
    cached = next;
    writeLocal(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, []);

  return { level, choose };
}
