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

const VOICE_KEY = "anatomy-atelier:voice:v1";

/**
 * macOS ships dozens of novelty voices — Boing, Bubbles, Zarvox, Cellos and the
 * rest. On this machine 36 of 41 English voices were of that kind. They must be
 * filtered out rather than listed: given a plain list, a child picks Boing and
 * the app reads anatomy in a cartoon noise.
 */
const NOVELTY = /^(Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Albert|Junior|Ralph|Kathy|Fred|Grandma|Grandpa|Rocko|Shelley|Sandy|Eddy|Flo|Reed|Rishi)\b/i;

/** Downloaded high-quality voices, which sound markedly better than the compact
 *  ones, and network voices where a browser offers them. Preferred when present. */
const HIGH_QUALITY = /enhanced|premium|siri|natural|neural/i;

export type VoiceChoice = { name: string; label: string; quality: boolean };

function usableVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.startsWith("en") && !NOVELTY.test(voice.name));
}

/** Best available, so the default isn't just whatever the OS happens to hand back
 *  — which on macOS is Samantha, the weakest of the usable set. */
function bestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => HIGH_QUALITY.test(voice.name)) ??
    voices.find((voice) => !voice.localService) ??
    voices.find((voice) => voice.lang === "en-GB") ??
    voices[0]
  );
}

/**
 * The voice list, which arrives asynchronously. `getVoices()` is empty on the
 * first call in Chrome — waiting for `voiceschanged` is the fix, rather than
 * giving up on voice selection as this file previously did.
 */
/**
 * The list genuinely changes over time — `getVoices()` is empty on the first call
 * in Chrome and fills in later — so this is a real external store rather than
 * something to poke at from an effect.
 *
 * The snapshot has to be a cached array: `getVoices()` returns a fresh one every
 * call, and returning a new reference each time would re-render forever.
 */
let voiceSnapshot: VoiceChoice[] | null = null;
let chosenSnapshot: string | null | undefined;
const EMPTY: VoiceChoice[] = [];

function voiceOptions(): VoiceChoice[] {
  if (voiceSnapshot === null) {
    voiceSnapshot = usableVoices().map((voice) => ({
      name: voice.name,
      label: `${voice.name.replace(/\s*\(.*\)$/, "")} · ${voice.lang}`,
      quality: HIGH_QUALITY.test(voice.name) || !voice.localService,
    }));
  }
  return voiceSnapshot;
}

function storedVoice(): string | null {
  if (chosenSnapshot === undefined) {
    try {
      chosenSnapshot = window.localStorage.getItem(VOICE_KEY);
    } catch {
      chosenSnapshot = null;
    }
  }
  return chosenSnapshot;
}

const voiceListeners = new Set<() => void>();

function subscribeVoices(onChange: () => void) {
  voiceListeners.add(onChange);
  const invalidate = () => {
    voiceSnapshot = null;
    voiceListeners.forEach((listener) => listener());
  };
  if (speechSupported()) window.speechSynthesis.addEventListener("voiceschanged", invalidate);
  return () => {
    voiceListeners.delete(onChange);
    if (speechSupported()) window.speechSynthesis.removeEventListener("voiceschanged", invalidate);
  };
}

export function useVoices() {
  const options = useSyncExternalStore(subscribeVoices, voiceOptions, () => EMPTY);
  const chosen = useSyncExternalStore(subscribeVoices, storedVoice, () => null);

  const choose = useCallback((name: string) => {
    chosenSnapshot = name;
    try {
      window.localStorage.setItem(VOICE_KEY, name);
    } catch {
      // Private mode; the choice just won't persist past this visit.
    }
    voiceListeners.forEach((listener) => listener());
  }, []);

  return { options, chosen, choose, anyHighQuality: options.some((option) => option.quality) };
}

function resolveVoice(): SpeechSynthesisVoice | undefined {
  const voices = usableVoices();
  if (!voices.length) return undefined;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(VOICE_KEY);
  } catch {
    stored = null;
  }
  return voices.find((voice) => voice.name === stored) ?? bestVoice(voices);
}

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
      const voice = resolveVoice();
      if (voice) {
        utterance.voice = voice;
        // Setting a voice without matching the lang makes some engines fall back
        // to the default anyway, silently undoing the choice.
        utterance.lang = voice.lang;
      } else {
        utterance.lang = document.documentElement.lang || "en";
      }
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
