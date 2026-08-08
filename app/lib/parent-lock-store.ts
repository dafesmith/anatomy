"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./local-store";

/**
 * The grown-up gate.
 *
 * This is a **consent gate, not a security boundary** — worth being precise about,
 * because the difference decides how much to trust it. It stops a young child
 * wandering into settings meant for an adult. It does not stop anyone who opens
 * devtools or clears site data, and it cannot: every check here runs in the
 * browser the child is holding.
 *
 * The PIN is stored as a salted SHA-256 hash so it isn't sitting in plain sight,
 * but four digits is 10,000 candidates — anyone who reads localStorage can
 * recover it in milliseconds. The hash raises the effort from "glance at it" to
 * "write a loop", which is the right bar for a gate whose job is stopping
 * accidents, and the wrong bar for anything that actually needs to be secret.
 *
 * Anything that must genuinely hold — spend caps, abuse limits — belongs on the
 * server, not here.
 */
export type ParentSettings = {
  /** The 72 clinical conditions, hidden while a kid reading level is active. */
  showConditions: boolean;
  /** Asking questions at all. Off until a grown-up turns it on. */
  askEnabled: boolean;
  /**
   * Whether a child may type freely, or only use the suggested buttons.
   *
   * Buttons-only is the safer default and also the more usable one for a young
   * child, who can tap but not type. It is a real safety boundary rather than a
   * preference: with no text box there is nothing to type a symptom into.
   */
  freeTypingEnabled: boolean;
};

const PIN_KEY = "anatomy-atelier:parent-pin:v1";
const SETTINGS_KEY = "anatomy-atelier:parent-settings:v1";

/**
 * Safe by default. A fresh install hides the conditions, cannot ask questions, and
 * has no text box — with no PIN ever set. The defaults do the protecting, because
 * most parents will never open this panel.
 */
const DEFAULTS: ParentSettings = {
  showConditions: false,
  askEnabled: false,
  freeTypingEnabled: false,
};

type StoredPin = { salt: string; hash: string };

export function pinAvailable() {
  return typeof window !== "undefined" && !!window.crypto?.subtle;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readPin(): StoredPin | null {
  const stored = readLocal(PIN_KEY);
  if (!stored || typeof stored !== "object") return null;
  const { salt, hash } = stored as StoredPin;
  return typeof salt === "string" && typeof hash === "string" ? { salt, hash } : null;
}

function readSettings(): ParentSettings {
  const stored = readLocal(SETTINGS_KEY);
  if (!stored || typeof stored !== "object") return DEFAULTS;
  // Each flag must be explicitly `true` to count. A settings blob written by an
  // older version simply lacks the newer keys, and those default to off rather
  // than to on — the safe direction for a setting a parent hasn't seen yet.
  const saved = stored as Partial<ParentSettings>;
  return {
    showConditions: saved.showConditions === true,
    askEnabled: saved.askEnabled === true,
    freeTypingEnabled: saved.freeTypingEnabled === true,
  };
}

// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let cached: { pin: StoredPin | null; settings: ParentSettings } | null = null;
/** Unlocking is deliberately in memory only, so closing the tab re-locks — the
 *  expected behaviour on a tablet shared with a child. */
let unlocked = false;

type Snapshot = { hasPin: boolean; unlocked: boolean; settings: ParentSettings };
let snapshot: Snapshot | null = null;
const SERVER_SNAPSHOT: Snapshot = { hasPin: false, unlocked: false, settings: DEFAULTS };

function state() {
  if (cached === null) cached = { pin: readPin(), settings: readSettings() };
  return cached;
}

/** Cached object identity matters here — `useSyncExternalStore` re-renders on any
 *  new reference, so the snapshot is rebuilt only when something actually changes. */
function getSnapshot(): Snapshot {
  if (snapshot === null) {
    const current = state();
    snapshot = { hasPin: current.pin !== null, unlocked, settings: current.settings };
  }
  return snapshot;
}

function changed() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useParentLock() {
  const { hasPin, unlocked: isUnlocked, settings } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );

  const setPin = useCallback(async (pin: string) => {
    const salt = [...window.crypto.getRandomValues(new Uint8Array(8))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const stored = { salt, hash: await hashPin(pin, salt) };
    writeLocal(PIN_KEY, stored);
    state().pin = stored;
    unlocked = true;
    changed();
  }, []);

  const unlock = useCallback(async (pin: string) => {
    const stored = state().pin;
    if (!stored) return false;
    const match = (await hashPin(pin, stored.salt)) === stored.hash;
    if (!match) return false;
    unlocked = true;
    changed();
    return true;
  }, []);

  const lock = useCallback(() => {
    unlocked = false;
    changed();
  }, []);

  const update = useCallback((next: Partial<ParentSettings>) => {
    // Guard rather than trust the caller: a settings write that slipped through
    // while locked would defeat the whole gate.
    if (!unlocked) return;
    const merged = { ...state().settings, ...next };
    writeLocal(SETTINGS_KEY, merged);
    state().settings = merged;
    changed();
  }, []);

  /** Forgetting the PIN is the honest weak spot — the only recovery a
   *  browser-only app can offer is clearing it, which a child could also do. */
  const forgetPin = useCallback(() => {
    writeLocal(PIN_KEY, null);
    writeLocal(SETTINGS_KEY, DEFAULTS);
    cached = { pin: null, settings: DEFAULTS };
    unlocked = false;
    changed();
  }, []);

  return { hasPin, unlocked: isUnlocked, settings, setPin, unlock, lock, update, forgetPin };
}
