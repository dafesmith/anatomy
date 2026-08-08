"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReadingLevel } from "./kid-readings";

/** Younger readers get a slower voice; the original wording reads at full speed. */
const RATE: Record<ReadingLevel, number> = {
  simple: 0.85,
  standard: 0.92,
  original: 1,
};

function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Support never changes after load, so nothing ever needs to notify. */
const noopSubscribe = () => () => {};

/**
 * Read-aloud built on the browser's own `speechSynthesis` — no dependency, no API
 * key, no network, and it works offline.
 *
 * Deliberately never autoplays: speech only ever starts from a click, which also
 * satisfies iOS Safari's requirement that speech begin inside a user gesture.
 *
 * No voice is selected. Picking one would mean calling `getVoices()`, which
 * returns an empty list on the first call in Chrome — the browser default avoids
 * that race entirely at the cost of using whatever the OS provides.
 */
export function useSpeech(level: ReadingLevel) {
  // Server-rendered markup can't know whether speech exists, so the server
  // snapshot is `false` and the client's real answer arrives without a hydration
  // mismatch. That keeps the buttons from rendering at all where they'd be dead.
  const supported = useSyncExternalStore(noopSubscribe, speechSupported, () => false);
  /** Identifies which button is currently speaking, so only that one shows Stop. */
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const speakingIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.cancel();
    speakingIdRef.current = null;
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!speechSupported() || !text.trim()) return;
      // Tapping a second button replaces the first rather than talking over it.
      const alreadySpeaking = speakingIdRef.current === id;
      window.speechSynthesis.cancel();
      if (alreadySpeaking) {
        speakingIdRef.current = null;
        setSpeakingId(null);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = RATE[level];
      utterance.lang = document.documentElement.lang || "en";
      const clear = () => {
        if (speakingIdRef.current !== id) return;
        speakingIdRef.current = null;
        setSpeakingId(null);
      };
      utterance.onend = clear;
      utterance.onerror = clear;
      speakingIdRef.current = id;
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    },
    [level],
  );

  // Leaving the page mid-sentence shouldn't leave a voice reading the old organ.
  useEffect(() => stop, [stop]);

  return { supported, speakingId, speak, stop };
}
