"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./local-store";
import type { MotionKind } from "./organ-motion";

/**
 * The sound of an organ working, synthesised rather than sampled.
 *
 * No audio files: a heart thump is a low sine with a fast decay and a breath is
 * filtered noise, both of which are a few lines of Web Audio and nothing to
 * download. It also means the sound is generated at the instant the viewer says
 * the organ is at its fullest, so the ear and the eye cannot drift apart.
 *
 * Deliberately quiet. This should be felt underneath the room rather than
 * listened to — a heartbeat loud enough to notice properly becomes unbearable
 * within a minute, and this plays for as long as a child leaves the page open.
 */
const MASTER_GAIN = 0.16;

const STORAGE_KEY = "anatomy-atelier:organ-sound:v1";

export class OrganSound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  /** One shared noise buffer — regenerating it per breath is pure waste. */
  private noise: AudioBuffer | null = null;

  /**
   * Built on the first play rather than in the constructor.
   *
   * Browsers refuse to start an `AudioContext` without a user gesture, and one
   * created too early lands in `suspended` and stays there silently. Since sound
   * is off until somebody presses the button, the first play is always inside a
   * gesture — the policy and the default agree with each other for once.
   */
  private ready(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) {
      // Returning to the tab can leave it suspended.
      if (this.context.state === "suspended") void this.context.resume();
      return this.context;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(this.context.destination);
    return this.context;
  }

  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const frames = context.sampleRate * 1.2;
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  /**
   * One beat, breath or squeeze.
   *
   * `strength` is the cue's relative loudness, so a heartbeat's softer second
   * thump is quieter here too rather than being two identical knocks.
   */
  play(kind: MotionKind, strength: number) {
    const context = this.ready();
    if (!context || !this.master) return;
    const now = context.currentTime;

    if (kind === "heartbeat") {
      // A chest thump is mostly one low frequency that drops as it decays. The
      // pitch slide is what makes it a thump rather than a beep.
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(62, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(strength, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.24);
      return;
    }

    // Breath and the peristaltic squeeze are both moving air or fluid: noise
    // through a band-pass, opened and closed slowly. The squeeze sits lower and
    // shorter so it does not read as another breath.
    const breath = kind === "breath";
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer(context);

    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = breath ? 520 : 240;
    band.Q.value = breath ? 0.9 : 1.4;

    const length = breath ? 1.1 : 0.55;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(strength * (breath ? 0.5 : 0.32), now + length * 0.4);
    gain.gain.linearRampToValueAtTime(0.0001, now + length);

    source.connect(band).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + length);
  }

  /** Silences everything without tearing the context down, for a covered viewer. */
  mute(muted: boolean) {
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.context.currentTime, 0.05);
  }

  dispose() {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.noise = null;
  }
}

// ---------------------------------------------------------------------------
// The on/off preference. Off by default — sound that starts on its own is a
// nasty surprise on a shared tablet, and browsers would block it anyway.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let cached: boolean | null = null;

function getSnapshot(): boolean {
  if (cached === null) cached = readLocal(STORAGE_KEY) === true;
  return cached;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useOrganSound() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = useCallback(() => {
    cached = !getSnapshot();
    writeLocal(STORAGE_KEY, cached);
    listeners.forEach((listener) => listener());
  }, []);

  return { enabled, toggle };
}
